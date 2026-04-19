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

export function isR2ObjectBody(obj: unknown): obj is R2ObjectBody {
	return (
		obj !== null &&
		typeof obj === 'object' &&
		'body' in obj &&
		'size' in obj &&
		'httpEtag' in obj &&
		typeof (obj as Record<string, unknown>).size === 'number'
	);
}

export function getFileExtension(pathname: string): string {
	return pathname.split('.').pop()?.toLowerCase() ?? '';
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

export function parseRangeHeader(rangeHeader: string): R2Range | undefined {
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
 * Fetches an object from R2 with support for HEAD, Range, and Image Transformations.
 *
 * Image transformations use fetch() with cf.image in RequestInit (not ResponseInit).
 */
export async function fetchFromR2(
	pathname: string,
	cfOptions: CfImageTransformOptions | null,
	env: Env,
	isHeadRequest: boolean,
	rangeHeader?: string,
): Promise<Response> {
	const objectKey = normalizeObjectKey(pathname);
	const hasTransformations = cfOptions !== null && Object.keys(cfOptions).length > 0;

	try {
		if (isHeadRequest) {
			const headObj = await env.wolfstar_cdn.head(objectKey);
			if (!headObj) {
				return createErrorResponse('NOT_FOUND', 'Object not found in R2', 404);
			}

			const headers = new Headers();
			headObj.writeHttpMetadata(headers);
			headers.set('etag', headObj.httpEtag);
			headers.set('accept-ranges', 'bytes');
			headers.set('cache-control', `public, max-age=${IMMUTABLE_CACHE_TTL}, immutable`);

			return new Response(null, { headers });
		}

		if (hasTransformations) {
			const imageUrl = `https://${env.R2_WORKER_URL}/${objectKey}`;
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

		let range: R2Range | undefined;
		if (rangeHeader) {
			range = parseRangeHeader(rangeHeader);
		}

		const options: R2GetOptions = {};
		if (range) options.range = range;

		const object = await env.wolfstar_cdn.get(objectKey, options);
		if (!isR2ObjectBody(object)) {
			return createErrorResponse('NOT_FOUND', 'The requested resource could not be found', 404);
		}

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set('etag', object.httpEtag);
		headers.set('accept-ranges', 'bytes');
		headers.set('cache-control', `public, max-age=${IMMUTABLE_CACHE_TTL}, immutable`);

		if (range && object.range) {
			let start: number;
			let end: number;

			if ('offset' in object.range && 'length' in object.range) {
				start = object.range.offset ?? 0;
				const length = object.range.length ?? object.size - start;
				end = start + length - 1;
			} else if ('offset' in object.range) {
				start = object.range.offset ?? 0;
				end = object.size - 1;
			} else if ('suffix' in object.range) {
				start = object.size - (object.range.suffix ?? 0);
				end = object.size - 1;
			} else {
				return new Response(object.body, { headers });
			}

			headers.set('content-range', `bytes ${start}-${end}/${object.size}`);

			return new Response(object.body, {
				status: 206,
				statusText: 'Partial Content',
				headers,
			});
		}

		return new Response(object.body, { headers });
	} catch (error) {
		console.error(`R2 error for object '${objectKey}':`, error);
		return createErrorResponse('STORAGE_ERROR', 'Unable to retrieve the requested resource', 500);
	}
}
