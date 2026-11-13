import {
  negotiate,
  classifyPath,
  toMarkdownPath,
  linkAlternate,
  MARKDOWN_CONTENT_TYPE,
  HTML_CONTENT_TYPE,
  VARY_ACCEPT,
  LLMS_FULL_PATH,
  llmsFullRedirectTarget,
} from '../../lib/markdown-negotiation.mjs';

export default async (request: Request, context: any): Promise<Response> => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === LLMS_FULL_PATH) {
    return Response.redirect(new URL(llmsFullRedirectTarget(), request.url), 302);
  }

  const kind = classifyPath(pathname);

  if (kind === 'passthrough') {
    if (pathname === '/llms.txt') {
      const response = await context.next();
      const body = await response.arrayBuffer();
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'text/markdown; charset=utf-8');
      return new Response(body, { status: response.status, headers });
    }
    return context.next();
  }

  if (kind === 'markdown') {
    const response = await context.next();
    const body = await response.arrayBuffer();
    const headers = new Headers(response.headers);
    headers.set('Content-Type', MARKDOWN_CONTENT_TYPE);
    headers.set('Vary', VARY_ACCEPT);
    headers.set('Link', linkAlternate(pathname));
    headers.set('Content-Length', String(body.byteLength));
    return new Response(body, { status: response.status, headers });
  }

  // html content page
  const htmlResponse = await context.next();
  if (htmlResponse.status === 404) {
    return htmlResponse;
  }

  const accept = request.headers.get('Accept');
  const negotiated = negotiate(accept);

  if (negotiated === 'not-acceptable') {
    return new Response('Not Acceptable', {
      status: 406,
      headers: { Vary: VARY_ACCEPT },
    });
  }

  if (negotiated === 'markdown') {
    const twinPath = toMarkdownPath(pathname);
    const twinUrl = new URL(twinPath, request.url);
    const twinResponse = await context.next(new Request(twinUrl, request));
    const body = await twinResponse.arrayBuffer();
    const headers = new Headers(twinResponse.headers);
    headers.set('Content-Type', MARKDOWN_CONTENT_TYPE);
    headers.set('Vary', VARY_ACCEPT);
    headers.set('Link', linkAlternate(twinPath));
    headers.set('Content-Length', String(body.byteLength));
    return new Response(body, { status: twinResponse.status, headers });
  }

  // html
  const body = await htmlResponse.arrayBuffer();
  const headers = new Headers(htmlResponse.headers);
  headers.set('Content-Type', HTML_CONTENT_TYPE);
  headers.set('Vary', VARY_ACCEPT);
  headers.set('Link', linkAlternate(pathname));
  headers.set('Content-Length', String(body.byteLength));
  return new Response(body, { status: htmlResponse.status, headers });
};
NODEEOF
echo written