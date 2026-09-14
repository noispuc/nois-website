import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { google } from 'googleapis';

const SERVICE_ACCOUNT_JSON = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
const ROOT_FOLDER_ID = process.env.GDRIVE_ROOT_FOLDER_ID || process.env.GDRIVE_FOLDER_ID || '';
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
const KEEP_EXISTING_ON_EMPTY = String(process.env.KEEP_EXISTING_ON_EMPTY || 'true').toLowerCase() !== 'false';

const MANIFEST_PATH = 'data/images.json';
const TEMP_DIR = '.tmp/drive-images-sync';

const CATEGORY_CONFIG = [
    {
        category: 'banner',
        envName: 'GDRIVE_BANNER_FOLDER_ID',
        folderId: process.env.GDRIVE_BANNER_FOLDER_ID || '',
        assetDir: 'assets/images/banner',
        folderNames: ['banner', 'banners', 'home-banner', 'home-banners']
    },
    {
        category: 'team',
        envName: 'GDRIVE_TEAM_FOLDER_ID',
        folderId: process.env.GDRIVE_TEAM_FOLDER_ID || '',
        assetDir: 'assets/images/equipe',
        folderNames: ['equipe', 'team', 'membros', 'members', 'pessoas', 'people']
    },
    {
        category: 'project',
        envName: 'GDRIVE_PROJECT_FOLDER_ID',
        folderId: process.env.GDRIVE_PROJECT_FOLDER_ID || '',
        assetDir: 'assets/images/projetos',
        folderNames: ['projetos', 'projects', 'project', 'cases']
    }
];

const MIME_EXTENSIONS = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/avif': '.avif'
};

function requireEnv(value, name) {
    if (!value || !String(value).trim()) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
}

function parseServiceAccount(rawValue) {
    const trimmed = String(rawValue || '').trim();

    if (trimmed.startsWith('{')) {
        return JSON.parse(trimmed);
    }

    return JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
}

function normalizeForMatch(value) {
    if (!value) return '';

    return String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function slugify(value, fallback = 'image') {
    return normalizeForMatch(value) || fallback;
}

function titleFromFilename(value) {
    const withoutExt = path.basename(value || 'image', path.extname(value || ''));

    return withoutExt
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Image';
}

function cleanUnique(values) {
    const seen = new Set();
    const result = [];

    for (const value of values.flat()) {
        if (value === null || value === undefined) continue;

        const text = String(value).trim();
        if (!text) continue;

        const key = normalizeForMatch(text);
        if (!key || seen.has(key)) continue;

        seen.add(key);
        result.push(text);
    }

    return result;
}

function getExtension(file) {
    const ext = path.extname(file.name || '').toLowerCase();

    if (ext) return ext;
    return MIME_EXTENSIONS[file.mimeType] || '';
}

function parseOrder(fileName, index) {
    const base = path.basename(fileName || '', path.extname(fileName || ''));
    const match = base.match(/(^|[^0-9])([0-9]{1,3})([^0-9]|$)/);

    if (!match) return index + 1;
    return Number(match[2]);
}

async function readJsonFile(filePath, fallback) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

async function pathExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function parseCsv(text) {
    const rows = [];
    let current = '';
    let row = [];
    let insideQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (insideQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                insideQuotes = !insideQuotes;
            }
            continue;
        }

        if (char === ',' && !insideQuotes) {
            row.push(current);
            current = '';
            continue;
        }

        if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (char === '\r' && next === '\n') i += 1;
            row.push(current);
            current = '';

            if (row.some((cell) => String(cell).trim() !== '')) {
                rows.push(row);
            }
            row = [];
            continue;
        }

        current += char;
    }

    row.push(current);
    if (row.some((cell) => String(cell).trim() !== '')) {
        rows.push(row);
    }

    if (!rows.length) return [];

    const headers = rows[0].map((header) => String(header || '').trim());
    return rows.slice(1).map((cells) => {
        const item = {};
        headers.forEach((header, index) => {
            item[header] = String(cells[index] || '').trim();
        });
        return item;
    });
}

async function readCsvRows(filePath) {
    try {
        const text = await fs.readFile(filePath, 'utf8');
        return parseCsv(text.replace(/^\uFEFF/, ''));
    } catch {
        return [];
    }
}

function addAlias(map, category, candidate, aliases) {
    const key = `${category}:${normalizeForMatch(candidate)}`;
    if (!key.endsWith(':')) {
        map.set(key, cleanUnique([map.get(key) || [], aliases]));
    }
}

async function buildCsvAliasMap() {
    const map = new Map();

    const teamRows = await readCsvRows('csv/equipe.csv');
    for (const row of teamRows) {
        const name = row.nome || row.Nome || row.name || '';
        const photo = row.foto || row.Foto || row.image || row.imagem || '';
        const aliases = [
            name,
            normalizeForMatch(name),
            photo,
            path.basename(photo || ''),
            normalizeForMatch(photo)
        ];

        addAlias(map, 'team', name, aliases);
        addAlias(map, 'team', photo, aliases);
    }

    const projectRows = await readCsvRows('csv/projetos.csv');
    for (const row of projectRows) {
        const title = row.Titulo || row.titulo || row.title || row.projeto || '';
        const image = row.imagem || row.Imagem || row.foto || row.Foto || row.capa || row.Capa || '';
        const aliases = [
            title,
            normalizeForMatch(title),
            image,
            path.basename(image || ''),
            normalizeForMatch(image)
        ];

        addAlias(map, 'project', title, aliases);
        addAlias(map, 'project', image, aliases);
    }

    return map;
}

function buildExistingAliasIndex(existingManifest) {
    const index = new Map();
    const images = Array.isArray(existingManifest?.images) ? existingManifest.images : [];

    for (const image of images) {
        const category = image.category || '';
        const candidates = cleanUnique([
            image.key,
            image.name,
            image.filename,
            path.basename(image.path || ''),
            image.aliases || []
        ]);

        for (const candidate of candidates) {
            const key = `${category}:${normalizeForMatch(candidate)}`;
            if (key.endsWith(':')) continue;

            if (!index.has(key)) index.set(key, []);
            index.get(key).push(image);
        }
    }

    return index;
}

function findExistingEntry(index, category, candidates) {
    for (const candidate of candidates) {
        const key = `${category}:${normalizeForMatch(candidate)}`;
        const entries = index.get(key);

        if (entries && entries.length) {
            return entries[0];
        }
    }

    return null;
}

async function createDriveClient() {
    requireEnv(SERVICE_ACCOUNT_JSON, 'GDRIVE_SERVICE_ACCOUNT_JSON');

    const credentials = parseServiceAccount(SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    return google.drive({ version: 'v3', auth });
}

async function listChildren(drive, folderId) {
    const files = [];
    let pageToken;

    do {
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, md5Checksum, webViewLink)',
            orderBy: 'folder,name',
            pageSize: 1000,
            pageToken,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        files.push(...(response.data.files || []));
        pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return files;
}

async function findCategoryFolderIds(drive) {
    const result = new Map();

    for (const config of CATEGORY_CONFIG) {
        if (config.folderId) {
            result.set(config.category, config.folderId);
        }
    }

    if (result.size === CATEGORY_CONFIG.length || !ROOT_FOLDER_ID) {
        return result;
    }

    const rootChildren = await listChildren(drive, ROOT_FOLDER_ID);
    const folders = rootChildren.filter((file) => file.mimeType === 'application/vnd.google-apps.folder');

    for (const config of CATEGORY_CONFIG) {
        if (result.has(config.category)) continue;

        const match = folders.find((folder) => {
            const normalizedFolderName = normalizeForMatch(folder.name);
            return config.folderNames.some((name) => normalizeForMatch(name) === normalizedFolderName);
        });

        if (match) {
            result.set(config.category, match.id);
        }
    }

    return result;
}

async function listImageFilesRecursive(drive, folderId, parentPath = '') {
    const children = await listChildren(drive, folderId);
    const images = [];

    for (const child of children) {
        if (child.mimeType === 'application/vnd.google-apps.folder') {
            const nested = await listImageFilesRecursive(drive, child.id, `${parentPath}${child.name}/`);
            images.push(...nested);
            continue;
        }

        if (child.mimeType && child.mimeType.startsWith('image/')) {
            images.push({ ...child, drivePath: `${parentPath}${child.name}` });
        }
    }

    return images;
}

async function downloadFile(drive, fileId, destinationPath) {
    const response = await drive.files.get(
        {
            fileId,
            alt: 'media',
            supportsAllDrives: true
        },
        {
            responseType: 'stream'
        }
    );

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await pipeline(response.data, createWriteStream(destinationPath));
}

function buildSafeFilename(file, usedFilenames) {
    const extension = getExtension(file);
    const base = path.basename(file.name || 'image', path.extname(file.name || ''));
    const safeBase = slugify(base, 'image');
    let filename = `${safeBase}${extension}`;

    if (!usedFilenames.has(filename)) {
        usedFilenames.add(filename);
        return filename;
    }

    const suffix = String(file.id || '').slice(0, 8) || Date.now().toString(36);
    filename = `${safeBase}-${suffix}${extension}`;

    let count = 2;
    while (usedFilenames.has(filename)) {
        filename = `${safeBase}-${suffix}-${count}${extension}`;
        count += 1;
    }

    usedFilenames.add(filename);
    return filename;
}

function buildEntry({ file, filename, category, config, index, existingIndex, csvAliasMap }) {
    const originalBase = path.basename(file.name || 'image', path.extname(file.name || ''));
    const safeBase = path.basename(filename, path.extname(filename));
    const order = category === 'banner' ? parseOrder(file.name, index) : undefined;
    const defaultKey = category === 'banner' && order ? `banner-${String(order).padStart(2, '0')}` : safeBase;

    const candidates = cleanUnique([file.name, file.drivePath, originalBase, filename, safeBase, defaultKey]);
    const existing = findExistingEntry(existingIndex, category, candidates);
    const csvAliases = candidates.flatMap((candidate) => csvAliasMap.get(`${category}:${normalizeForMatch(candidate)}`) || []);

    const key = existing?.key || defaultKey;
    const name = existing?.name || titleFromFilename(file.name);
    const alt = existing?.alt || name;
    const finalOrder = existing?.order || order;

    const aliases = cleanUnique([
        file.name,
        file.drivePath,
        originalBase,
        filename,
        safeBase,
        key,
        name,
        csvAliases,
        existing?.aliases || []
    ]);

    const entry = {
        category,
        key,
        name,
        filename,
        path: `${config.assetDir}/${filename}`.replace(/\\/g, '/'),
        alt,
        aliases,
        source: {
            type: 'google-drive',
            fileId: file.id,
            drivePath: file.drivePath || file.name
        },
        mimeType: file.mimeType || null,
        modifiedTime: file.modifiedTime || null,
        size: file.size ? Number(file.size) : null,
        md5Checksum: file.md5Checksum || null,
        webViewLink: file.webViewLink || null
    };

    if (finalOrder !== undefined && finalOrder !== null) {
        entry.order = Number(finalOrder);
    }

    return entry;
}

async function syncCategory({ drive, config, folderId, existingIndex, csvAliasMap }) {
    console.log(`\n[${config.category}] Reading Drive folder ${folderId}...`);

    const driveImages = await listImageFilesRecursive(drive, folderId);
    console.log(`[${config.category}] Found ${driveImages.length} image(s).`);

    if (!driveImages.length && KEEP_EXISTING_ON_EMPTY) {
        console.log(`[${config.category}] Empty folder. Keeping existing local files and manifest entries.`);
        return null;
    }

    const categoryTempDir = path.join(TEMP_DIR, config.assetDir);
    await fs.mkdir(categoryTempDir, { recursive: true });

    const usedFilenames = new Set();
    const entries = [];

    for (let index = 0; index < driveImages.length; index += 1) {
        const file = driveImages[index];
        const filename = buildSafeFilename(file, usedFilenames);
        const destinationPath = path.join(categoryTempDir, filename);

        console.log(`[${config.category}] Downloading ${file.drivePath || file.name} -> ${filename}`);

        if (!DRY_RUN) {
            await downloadFile(drive, file.id, destinationPath);
        }

        const entry = buildEntry({
            file,
            filename,
            category: config.category,
            config,
            index,
            existingIndex,
            csvAliasMap
        });

        entries.push(entry);
    }

    entries.sort((a, b) => {
        if (a.category === 'banner' || b.category === 'banner') {
            return (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
    });

    return {
        config,
        entries
    };
}

async function replaceDirectory(fromDir, toDir) {
    await fs.rm(toDir, { recursive: true, force: true });
    await fs.mkdir(path.dirname(toDir), { recursive: true });
    await fs.cp(fromDir, toDir, { recursive: true });
}

function mergeManifest(existingManifest, syncedCategories) {
    const syncedCategoryNames = new Set(syncedCategories.map((item) => item.config.category));
    const existingImages = Array.isArray(existingManifest?.images) ? existingManifest.images : [];
    const preservedImages = existingImages.filter((image) => !syncedCategoryNames.has(image.category));
    const syncedImages = syncedCategories.flatMap((item) => item.entries);

    return {
        generatedAt: new Date().toISOString(),
        source: {
            type: 'google-drive-actions',
            note: 'Generated by GitHub Actions from Google Drive.'
        },
        images: [...preservedImages, ...syncedImages]
    };
}

async function validateManifestPaths(manifest) {
    const missing = [];

    for (const image of manifest.images || []) {
        if (!image.path) continue;
        if (!(await pathExists(image.path))) {
            missing.push(image.path);
        }
    }

    if (missing.length) {
        throw new Error(`Manifest contains paths that do not exist:\n${missing.join('\n')}`);
    }
}

async function main() {
    const existingManifest = await readJsonFile(MANIFEST_PATH, { images: [] });
    const existingIndex = buildExistingAliasIndex(existingManifest);
    const csvAliasMap = await buildCsvAliasMap();
    const drive = await createDriveClient();

    await fs.rm(TEMP_DIR, { recursive: true, force: true });
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const folderIds = await findCategoryFolderIds(drive);
    const categoriesToSync = CATEGORY_CONFIG.filter((config) => folderIds.has(config.category));

    if (!categoriesToSync.length) {
        throw new Error(
            'No Google Drive image folders configured. Set GDRIVE_ROOT_FOLDER_ID with subfolders banner/equipe/projetos, or set GDRIVE_BANNER_FOLDER_ID, GDRIVE_TEAM_FOLDER_ID and/or GDRIVE_PROJECT_FOLDER_ID.'
        );
    }

    console.log(`Syncing categories: ${categoriesToSync.map((item) => item.category).join(', ')}`);

    const syncedCategories = [];

    for (const config of categoriesToSync) {
        const synced = await syncCategory({
            drive,
            config,
            folderId: folderIds.get(config.category),
            existingIndex,
            csvAliasMap
        });

        if (synced) {
            syncedCategories.push(synced);
        }
    }

    if (!syncedCategories.length) {
        console.log('No categories were updated. Existing files and manifest kept unchanged.');
        return;
    }

    const nextManifest = mergeManifest(existingManifest, syncedCategories);

    if (DRY_RUN) {
        console.log('\nDRY_RUN=true. No files were changed. Preview manifest:');
        console.log(JSON.stringify(nextManifest, null, 2));
        return;
    }

    for (const synced of syncedCategories) {
        await replaceDirectory(
            path.join(TEMP_DIR, synced.config.assetDir),
            synced.config.assetDir
        );
    }

    await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(nextManifest, null, 2) + '\n', 'utf8');

    await validateManifestPaths(nextManifest);
    await fs.rm(TEMP_DIR, { recursive: true, force: true });

    console.log(`\nDone. Wrote ${MANIFEST_PATH} with ${nextManifest.images.length} image(s).`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
