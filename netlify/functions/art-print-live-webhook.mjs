import { handleLivePrintWebhook } from '../lib/print-live-webhook.mjs';

export default (request,context)=>handleLivePrintWebhook(request,context);
