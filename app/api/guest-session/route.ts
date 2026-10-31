import {database} from '@/lib/database';
import {guestCookieValue,expireGuestCookie,guardOrigin} from '@/lib/visitor';
export async function DELETE(req:Request){try{guardOrigin(req);const token=guestCookieValue(req);if(token)await database().prepare('DELETE FROM nutrition_accounts WHERE user_id=?').bind('guest:'+token).run();return Response.json({ended:true},{headers:{'Set-Cookie':expireGuestCookie(req),'Cache-Control':'no-store'}});}catch{return Response.json({error:'Unable to end this guest session. Please retry.'},{status:400});}}
