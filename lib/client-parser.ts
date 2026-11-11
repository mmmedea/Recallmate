export const readFileSafely = async (file: File): Promise<ArrayBuffer> => {
  if (typeof file.arrayBuffer === "function") {
    return await file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Browser failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

export const compressImage = (file: File | Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const maxDim = 1500; 
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Compression failed"));
      }, "image/jpeg", 0.7); 
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = url;
  });
};

export const compressPdfToImage = async (buffer: ArrayBuffer, pdfjsLib: any): Promise<Blob> => {
  if (!pdfjsLib) {
    const pdfjsModule = await import("pdfjs-dist");
    pdfjsLib = pdfjsModule.default || pdfjsModule;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false });
  const pdf = await loadingTask.promise;
  
  const maxPages = Math.min(pdf.numPages, 4); 
  const canvases = [];
  let totalHeight = 0;
  let maxWidth = 0;

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      canvases.push(canvas);
      totalHeight += canvas.height;
      if (canvas.width > maxWidth) maxWidth = canvas.width;
    }
    page.cleanup();
  }

  const masterCanvas = document.createElement("canvas");
  masterCanvas.width = maxWidth;
  masterCanvas.height = totalHeight;
  const masterCtx = masterCanvas.getContext("2d");

  let currentY = 0;
  for (const c of canvases) {
    masterCtx?.drawImage(c, 0, currentY);
    currentY += c.height;
  }
  pdf.destroy();

  return new Promise((resolve, reject) => {
    masterCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PDF to Image compression failed"));
    }, "image/jpeg", 0.6); 
  });
};

const MAX_AI_CHARS = 8000;

export const processFileClientSide = async (rawFile: File): Promise<string> => {
  let originalName = rawFile.name || "upload";
  let tempFileName = originalName.toLowerCase();
  
  let extMatch = tempFileName.match(/\.[0-9a-z]+$/i);
  let ext = extMatch ? extMatch[0] : "";

  const mime = (rawFile.type || "").toLowerCase();
  if (!ext || !['.txt','.md','.csv','.doc','.docx','.pdf','.pptx','.jpg','.jpeg','.png','.webp','.mp4','.mp3'].includes(ext)) {
    if (mime.includes("pdf")) ext = ".pdf";
    else if (mime.includes("presentation") || mime.includes("powerpoint")) ext = ".pptx";
    else if (mime.includes("word") || mime.includes("document")) ext = ".docx";
    else if (mime.includes("text/plain")) ext = ".txt";
    else if (mime.includes("csv")) ext = ".csv";
    else if (mime.includes("image/jpeg")) ext = ".jpg";
    else if (mime.includes("image/png")) ext = ".png";
    else ext = ".bin"; 
    
    tempFileName = `upload${ext}`;
  }

  let safeFileName = `file_${Date.now()}${ext}`;
  let extractedTextForFile = "";
  let clientSideFailed = false;

  let arrayBuffer: ArrayBuffer | null = null;
  try {
    arrayBuffer = await readFileSafely(rawFile);
  } catch (e) {
    clientSideFailed = true;
  }

  let pdfjsLib: any = null;
  let mammothLib: any = null;

  if (arrayBuffer && !clientSideFailed) {
    const runClientExtraction = async (): Promise<string> => {
      let resultText = "";

      if (ext === ".txt" || ext === ".md" || ext === ".csv") {
        const textDecoder = new TextDecoder("utf-8");
        resultText = textDecoder.decode(arrayBuffer!);
      } 
      else if (ext === ".docx" || ext === ".doc") {
        if (!mammothLib) {
          const mammothModule = await import("mammoth");
          mammothLib = mammothModule.default || mammothModule;
        }
        const result = await mammothLib.extractRawText({ arrayBuffer: arrayBuffer! });
        resultText = result.value;
      }
      else if (ext === ".pptx") {
        const zipModule = await import("jszip");
        const JSZip = zipModule.default || zipModule;
        const zip = new (JSZip as any)();
        
        const uintArray = new Uint8Array(arrayBuffer!);
        const loadedZip = await zip.loadAsync(uintArray);
        
        for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
          if (relativePath.startsWith("ppt/slides/slide") && relativePath.endsWith(".xml")) {
            const xmlContent = await (zipEntry as any).async("string");
            const textMatches = xmlContent.match(/<a:t>([\s\S]*?)<\/a:t>/g);
            if (textMatches) {
              const slideText = textMatches.map((match: string) => match.replace(/<\/?a:t>/g, '')).join(" ");
              resultText += slideText + "\n";
            }
          }
          if (resultText.length > MAX_AI_CHARS) break; 
        }
      }
      else if (ext === ".pdf") {
        if (!pdfjsLib) {
          const pdfjsModule = await import("pdfjs-dist");
          pdfjsLib = pdfjsModule.default || pdfjsModule;
          // Use CDN for worker to prevent relative path/CORS issues in mobile in-app browsers
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        }
        
        const uint8Array = new Uint8Array(arrayBuffer!);
        
        const loadingTask = pdfjsLib.getDocument({
          data: uint8Array,
          isEvalSupported: false,
        });

        const pdf = await loadingTask.promise;
        const maxPages = Math.min(pdf.numPages, 100);
        
        for (let i = 1; i <= maxPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(" ");
            resultText += pageText + "\n";
            page.cleanup();
            
            if (resultText.length > MAX_AI_CHARS) {
              break;
            }
          } catch (e) {}
        }
        pdf.destroy();
      }

      return resultText;
    };

    try {
      extractedTextForFile = await Promise.race([
        runClientExtraction(),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error("Extraction timed out")), 45000)
        )
      ]);
    } catch (clientErr) {
      console.warn("Client extraction timed out or failed, falling back to server...", clientErr);
      clientSideFailed = true;
    }
  } else {
    clientSideFailed = true;
  }

  const isTextEmpty = !extractedTextForFile.trim();

  if (
    clientSideFailed || 
    isTextEmpty ||
    (![".txt", ".md", ".csv", ".doc", ".docx", ".pdf", ".pptx"].includes(ext))
  ) {
    let fileToSend: File | Blob = rawFile;
    let finalExt = ext;

    if (rawFile.size > 4.5 * 1024 * 1024) {
      if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
          try { fileToSend = await compressImage(rawFile); } catch (e) {}
      } 
      else if (ext === ".pdf" && isTextEmpty && arrayBuffer) {
          try {
            fileToSend = await compressPdfToImage(arrayBuffer, pdfjsLib);
            finalExt = ".jpg"; 
            safeFileName = `compressed_scan_${Date.now()}.jpg`;
          } catch (e) {
            console.error("PDF Visual Compression Failed", e);
          }
      }
    }

    if (fileToSend.size > 4.5 * 1024 * 1024) {
      if (ext === ".pdf" && isTextEmpty && !clientSideFailed) {
          throw new Error(`"${originalName}" is a scanned document and too large to compress automatically. Please use an online PDF compressor first.`);
      }
      if (clientSideFailed) {
        throw new Error(`"${originalName}" is too large for the server, and your browser failed to process it locally. Please try uploading on a desktop or compress the file first.`);
      }
      throw new Error(`"${originalName}" is too large. Server extraction limit is 4.5MB.`);
    }

    let safeMime = "application/octet-stream";
    if (finalExt === ".jpg" || finalExt === ".jpeg") safeMime = "image/jpeg";
    else if (finalExt === ".png") safeMime = "image/png";
    else if (finalExt === ".webp") safeMime = "image/webp";
    else if (finalExt === ".mp4") safeMime = "video/mp4";
    else if (finalExt === ".mp3") safeMime = "audio/mpeg";
    else if (finalExt === ".pdf") safeMime = "application/pdf";
    else if (finalExt === ".pptx") safeMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    else if (finalExt === ".docx") safeMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const pristineBlob = new Blob([fileToSend], { type: safeMime });
    const form = new FormData();
    form.append("file", pristineBlob, safeFileName);
    
    const isMedia = safeMime.startsWith("video/") || safeMime.startsWith("audio/");
    const endpoint = isMedia ? "/api/transcribe" : "/api/extract-text";
    
    const extractRes = await fetch(endpoint, { method: "POST", body: form });
    
    const contentType = extractRes.headers.get("content-type");
    let extractData;
    if (contentType && contentType.includes("application/json")) {
      extractData = await extractRes.json();
    } else {
      throw new Error(
        extractRes.status === 413 
          ? "File is too large for the server to process." 
          : "The server returned an unexpected error format."
      );
    }

    if (!extractRes.ok) {
      throw new Error(extractData.error || `Failed to read ${originalName}`);
    }
    
    extractedTextForFile = extractData.text;
  }

  return extractedTextForFile;
};
