import {env} from 'cloudflare:workers';
export function database(){const db=(env as any).DB;if(!db)throw Error('Storage is temporarily unavailable. Please retry.');return db;}
