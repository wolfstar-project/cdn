// ==== Type Definitions ====

// Types for image transformation
type CfImageFit = 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
type CfImageFormat = 'webp' | 'avif' | 'jpeg' | 'png';

interface CfImageTransformOptions {
	width?: number;
	height?: number;
	quality?: number;
	fit?: CfImageFit;
	format?: CfImageFormat;
}

// Custom response types
interface HealthResponse {
	status: string;
	timestamp: string;
	worker: string;
	region?: string;
}

interface ErrorResponse {
	error: string;
	message: string;
	timestamp: string;
}

// Cloudflare environment bindings (available via event.context.cloudflare.env)
interface CloudflareBindings {
	ALLOWED_ORIGINS: string;
	R2_WORKER_URL: string;
	wolfstar_cdn: R2Bucket;
	RATE_LIMITER: RateLimit;
}

export type { CfImageTransformOptions, HealthResponse, ErrorResponse, CfImageFit, CfImageFormat, CloudflareBindings };
