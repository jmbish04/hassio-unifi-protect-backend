export function json(obj: any, status = 200, customHeaders: Record<string, string> = {}): Response {
  const headers = new Headers({
    "content-type": "application/json",
    ...customHeaders
  });

  let jsonString: string;
  try {
    jsonString = JSON.stringify(obj);
  } catch (error) {
    // Handle circular references by creating a safe version
    const seen = new WeakSet();
    jsonString = JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  }

  return new Response(jsonString, {
    status,
    headers
  });
}
