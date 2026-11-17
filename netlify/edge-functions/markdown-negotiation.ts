import {
  negotiate,
  classifyPath,
  toMarkdownPath,
  applyRepresentationHeaders,
  MARKDOWN_CONTENT_TYPE,
  PLAIN_TEXT_CONTENT_TYPE,
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
      headers.set('Content-Type', MARKDOWN_CONTENT_TYPE);
      return new Response(body, { status: response.status, headers });
    }
    return context.next();
  }

  if (kind === 'markdown') {
    const response = await context.next();
    if (response.status === 404) {
      return response;
    }
    const body = await response.arrayBuffer();
    const headers = new Headers(response.headers);
    applyRepresentationHeaders((name, value) => headers.set(name, value), 'markdown', pathname);
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
      headers: {
        'Content-Type': PLAIN_TEXT_CONTENT_TYPE,
        Vary: VARY_ACCEPT,
      },
    });
  }

  if (negotiated === 'markdown') {
    const twinPath = toMarkdownPath(pathname);
    const twinUrl = new URL(twinPath, request.url);
    const twinResponse = await context.next(new Request(twinUrl, request));
    if (twinResponse.status === 404) {
      return twinResponse;
    }
    const body = await twinResponse.arrayBuffer();
    const headers = new Headers(twinResponse.headers);
    applyRepresentationHeaders((name, value) => headers.set(name, value), 'markdown', twinPath);
    return new Response(body, { status: twinResponse.status, headers });
  }

  // html
  const body = await htmlResponse.arrayBuffer();
  const headers = new Headers(htmlResponse.headers);
  applyRepresentationHeaders((name, value) => headers.set(name, value), 'html', pathname);
  return new Response(body, { status: htmlResponse.status, headers });
};
