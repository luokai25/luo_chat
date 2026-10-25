import {createPaymentWebhookHandler} from '../../../src/server/agent-payment-webhooks.js';
export const config={api:{bodyParser:false}};
export default createPaymentWebhookHandler({provider:'paypal'});
