// Rejects cross-site form posts. Requests from the same site carry a matching origin.
export function guardOrigin(req:Request){
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin)throw Error('This request must come from the nutrition website.');
  if(req.headers.get('sec-fetch-site')==='cross-site')throw Error('Cross-site requests are not allowed.');
}
