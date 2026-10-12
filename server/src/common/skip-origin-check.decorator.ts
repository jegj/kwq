import { SetMetadata } from '@nestjs/common';

export const SKIP_ORIGIN_CHECK = 'skipOriginCheck';

// For non-browser callers (webhooks) that authenticate some other way.
export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN_CHECK, true);
