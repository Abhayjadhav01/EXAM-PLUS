export async function readPdf(file: File): Promise<string> {
  // In a real app, we'd use a library like pdf.js
  // For now, we pass the base64 to Gemini directly which handles multimodal input
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
