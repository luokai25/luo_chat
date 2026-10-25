import {notActivated} from '../../../src/server/agent-platform.js';
// Release gate: public signup cannot create a billable agent until hosted billing,
// isolated identity storage and rate limits have been verified end to end.
export default notActivated;
