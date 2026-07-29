const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // Try to serve the exact file
    const filePath = "./dist/client" + (path === "/" ? "/index.html" : path);
    const file = Bun.file(filePath);
    if (await file.exists() && file.size > 0) {
      return new Response(file);
    }
    
    // Also try with .html extension
    const htmlPath = filePath + ".html";
    const htmlFile = Bun.file(htmlPath);
    if (await htmlFile.exists()) {
      return new Response(htmlFile);
    }
    
    // SPA fallback: serve index.html for client-side routing
    const indexFile = Bun.file("./dist/client/index.html");
    if (await indexFile.exists()) {
      return new Response(indexFile);
    }
    
    return new Response("Not Found", { status: 404 });
  }
});
console.log("Static site on port 3000");
