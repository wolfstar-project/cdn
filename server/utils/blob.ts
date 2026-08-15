import type { BlobStorage } from '@vite-hub/blob';
import { createDriver } from '@vite-hub/blob/drivers/cloudflare';
import { getNamedBlobRuntimeStorage, setNamedBlobRuntimeStorage } from '@vite-hub/blob/runtime/state';
import { createBlobStorage } from '@vite-hub/blob/storage';
import { useRuntimeConfig } from 'nitro/runtime-config';

import {
	ALLOWED_FIT_MODES,
	ALLOWED_FORMATS,
	DEFAULT_TRANSFORM_OPTIONS,
	IMAGE_EXTENSIONS,
	IMMUTABLE_CACHE_TTL,
	MAX_IMAGE_DIMENSION,
	MAX_QUALITY,
	MIN_IMAGE_DIMENSION,
	MIN_QUALITY,
} from './constants';
import { createErrorResponse } from './errors';
import type { CfImageFit, CfImageFormat, CfImageTransformOptions } from './types';

export function getFileExtension(pathname: string): string {
	return pathname.split('.').pop()?.toLowerCase() ?? '';
}

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
	avif: 'image/avif',
	gif: 'image/gif',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	png: 'image/png',
	svg: 'image/svg+xml',
	tiff: 'image/tiff',
	webp: 'image/webp',
};

/**
 * R2 objects uploaded without httpMetadata.contentType would otherwise be served with no
 * Content-Type, which browsers refuse to render as images due to X-Content-Type-Options: nosniff.
 */
function guessContentType(pathname: string): string | undefined {
	return EXTENSION_CONTENT_TYPES[getFileExtension(pathname)];
}

function normalizeObjectKey(pathname: string): string {
	return pathname.startsWith('/') ? pathname.slice(1) : pathname;
}

function validateImageDimension(value: number): boolean {
	return Number.isInteger(value) && value >= MIN_IMAGE_DIMENSION && value <= MAX_IMAGE_DIMENSION;
}

function validateImageQuality(value: number): boolean {
	return Number.isInteger(value) && value >= MIN_QUALITY && value <= MAX_QUALITY;
}

export function parseTransformations(pathname: string, searchParams: URLSearchParams): CfImageTransformOptions | null {
	const hasTransformationParams = ['w', 'h', 'q', 'fit', 'f'].some((p) => searchParams.has(p));
	const fileExtension = getFileExtension(pathname);
	const isImage = IMAGE_EXTENSIONS.has(fileExtension);

	if (!hasTransformationParams || !isImage) return null;

	const options: CfImageTransformOptions = { ...DEFAULT_TRANSFORM_OPTIONS };

	const widthParam = searchParams.get('w');
	if (widthParam) {
		const width = parseInt(widthParam, 10);
		if (validateImageDimension(width)) {
			options.width = width;
		}
	}

	const heightParam = searchParams.get('h');
	if (heightParam) {
		const height = parseInt(heightParam, 10);
		if (validateImageDimension(height)) {
			options.height = height;
		}
	}

	const qualityParam = searchParams.get('q');
	if (qualityParam) {
		const quality = parseInt(qualityParam, 10);
		if (validateImageQuality(quality)) {
			options.quality = quality;
		}
	}

	const fitParam = searchParams.get('fit') as CfImageFit;
	if (fitParam && ALLOWED_FIT_MODES.has(fitParam)) {
		options.fit = fitParam;
	}

	const formatParam = searchParams.get('f')?.toLowerCase() as CfImageFormat;
	if (formatParam && ALLOWED_FORMATS.has(formatParam)) {
		options.format = formatParam;
	} else if (formatParam) {
		const hasOtherValidParams = ['w', 'h', 'q', 'fit'].some((p) => searchParams.has(p));
		if (!hasOtherValidParams) {
			return null;
		}
	}

	return options;
}

function resolveBlobStorage(): BlobStorage {
	const existing = getNamedBlobRuntimeStorage('default');
	if (existing) return existing;

	const { blob } = useRuntimeConfig();
	if (!blob) {
		throw new Error('Blob runtime is disabled.');
	}

	if (blob.store.driver !== 'cloudflare-r2') {
		throw new Error(`Unsupported blob driver: ${blob.store.driver}`);
	}

	const storage = createBlobStorage(createDriver(blob.store));
	setNamedBlobRuntimeStorage('default', storage);
	return storage;
}

export function parseRangeHeader(rangeHeader: string):
	| {
			offset: number;
			length?: number;
	  }
	| undefined {
	const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
	if (!match) return undefined;

	const start = parseInt(match[1], 10);
	const end = match[2] ? parseInt(match[2], 10) : undefined;

	if (Number.isNaN(start) || (end !== undefined && Number.isNaN(end))) return undefined;
	if (end !== undefined && start > end) return undefined;

	return {
		offset: start,
		length: end !== undefined ? end - start + 1 : undefined,
	};
}

/**
 * Fetches an object from Blob storage with support for HEAD, Range, and Image Transformations.
 *
 * Image transformations use fetch() with cf.image in RequestInit (not ResponseInit).
 */
export async function fetchObject(
	pathname: string,
	cfOptions: CfImageTransformOptions | null,
	r2WorkerUrl: string,
	isHeadRequest: boolean,
	rangeHeader?: string,
): Promise<Response> {
	const objectKey = normalizeObjectKey(pathname);
	const hasTransformations = cfOptions !== null && Object.keys(cfOptions).length > 0;
	const storage = resolveBlobStorage();

	if (isHeadRequest) {
		let meta;
		try {
			meta = await storage.head(objectKey);
		} catch (err) {
			if ((err as { statusCode?: number }).statusCode === 404) {
				return createErrorResponse('NOT_FOUND', 'Object not found', 404);
			}
			throw err;
		}

		const headers = new Headers();
		const headContentType = meta.contentType || guessContentType(objectKey);
		if (headContentType) headers.set('content-type', headContentType);
		if (meta.size != null) headers.set('content-length', String(meta.size));
		if (meta.httpEtag) headers.set('etag', meta.httpEtag);
		headers.set('accept-ranges', 'bytes');
		headers.set('cache-control', `public, max-age=${IMMUTABLE_CACHE_TTL}, immutable`);

		return new Response(null, { headers });
	}

	if (hasTransformations) {
		const imageUrl = `https://${r2WorkerUrl}/${objectKey}`;
		const transformedResponse = await fetch(imageUrl, {
			cf: { image: cfOptions },
		} as RequestInit);

		if (!transformedResponse.ok) {
			return createErrorResponse('TRANSFORM_ERROR', 'Unable to process image', transformedResponse.status);
		}

		const headers = new Headers(transformedResponse.headers);
		headers.set('cache-control', `public, max-age=${IMMUTABLE_CACHE_TTL}, immutable`);

		return new Response(transformedResponse.body, { headers });
	}

	const object = await storage.get(objectKey);
	if (!object) {
		return createErrorResponse('NOT_FOUND', 'The requested resource could not be found', 404);
	}

	const headers = new Headers();
	const contentType = object.type || guessContentType(objectKey);
	if (contentType) headers.set('content-type', contentType);
	headers.set('accept-ranges', 'bytes');
	headers.set('cache-control', `public, max-age=${IMMUTABLE_CACHE_TTL}, immutable`);

	if (rangeHeader) {
		const range = parseRangeHeader(rangeHeader);
		if (range) {
			const start = range.offset;
			const end = range.length !== undefined ? start + range.length - 1 : object.size - 1;
			const sliced = object.slice(start, end + 1);

			headers.set('content-range', `bytes ${start}-${end}/${object.size}`);
			headers.set('content-length', String(end - start + 1));

			return new Response(sliced, {
				status: 206,
				statusText: 'Partial Content',
				headers,
			});
		}
	}

	headers.set('content-length', String(object.size));
	return new Response(object, { headers });
}
