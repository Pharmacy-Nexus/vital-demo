// request.formData() buffers the whole body; enforce a hard stream limit first.
// Production reverse proxy should ALSO cap request body bytes to reduce memory DoS.
export async function readBoundedFormData(request: Request, maximumBytes = 13 * 1024 * 1024) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maximumBytes || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximumBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = new Request(request.url, {
      method: "POST", headers: { "content-type": request.headers.get("content-type") ?? "" }, body: bytes.buffer as ArrayBuffer,
    });
    return await body.formData();
  } catch { return null; }
  finally { reader.releaseLock(); }
}
