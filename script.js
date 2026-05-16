const startCameraButton = document.getElementById('start-camera');
const captureButton = document.getElementById('capture-card');
const uploadInput = document.getElementById('upload-image');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ocrResult = document.getElementById('ocr-result');
const cardNameElement = document.getElementById('card-name');
const statusElement = document.getElementById('status');
const searchLinks = document.getElementById('search-links');

let stream = null;
let worker = null;

function setStatus(message) {
  statusElement.textContent = message;
}

function normalizeText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .trim();
}

function normalizeForSearch(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCardName(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  return lines[0];
}

function findCardMatch(text) {
  const normalizedText = normalizeForSearch(text);
  const candidates = mtgSpiderManSet.map((card) => ({
    card,
    normalized: normalizeForSearch(card.name),
  }));

  let best = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (normalizedText === candidate.normalized) {
      return candidate.card;
    }

    if (normalizedText.includes(candidate.normalized) || candidate.normalized.includes(normalizedText)) {
      return candidate.card;
    }

    const sharedWords = normalizedText
      .split(' ')
      .filter(Boolean)
      .filter((word) => candidate.normalized.includes(word));
    const score = sharedWords.length / Math.max(candidate.normalized.split(' ').length, 1);

    if (score > bestScore) {
      bestScore = score;
      best = candidate.card;
    }
  }

  return bestScore >= 0.5 ? best : null;
}

function updateSearchLinks(name) {
  searchLinks.innerHTML = '';
  if (!name) {
    return;
  }

  const queries = [
    {
      label: 'Search card name',
      url: `https://www.google.com/search?q=${encodeURIComponent(name + ' trading card')}`,
    },
    {
      label: 'Search TCG database',
      url: `https://www.tcgplayer.com/search/products?q=${encodeURIComponent(name)}`,
    },
    {
      label: 'Search Scryfall',
      url: `https://scryfall.com/search?q=${encodeURIComponent(name)}`,
    },
  ];

  queries.forEach((item) => {
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    link.textContent = item.label;
    searchLinks.appendChild(link);
  });
}

async function initTesseract() {
  if (worker) return worker;

  setStatus('Loading OCR engine...');
  worker = Tesseract.createWorker({
    logger: (m) => {
      if (m.status === 'recognizing text') {
        setStatus(`OCR: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  setStatus('OCR engine ready.');
  return worker;
}

async function recognizeCardImage(image) {
  try {
    const worker = await initTesseract();
    const { data } = await worker.recognize(image);
    return normalizeText(data.text || '');
  } catch (error) {
    console.error(error);
    setStatus('OCR failed. Try a clearer photo or better lighting.');
    return '';
  }
}
// --- FINAL OCR FUNCTION (validated image load) ---
async function runOCR(file) {
  console.log("Starting OCR…");

  const worker = await Tesseract.createWorker("eng");

  let imageSource;

  if (typeof file === "string" && file.startsWith("data:image")) {
    imageSource = new Image();
    imageSource.src = file;

    // Wait for image to fully load
    await new Promise((resolve, reject) => {
      imageSource.onload = () => {
        console.log("Image loaded successfully.");
        resolve();
      };
      imageSource.onerror = (err) => {
        console.error("Image failed to load:", err);
        reject(err);
      };
    });
  } else if (file instanceof Blob) {
    imageSource = URL.createObjectURL(file);
  } else {
    throw new Error("Unsupported file type for OCR.");
  }

  // Validate image dimensions before recognition
  if (!imageSource.width && !imageSource.height) {
    throw new Error("Image not loaded or invalid.");
  }

  const { data: { text } } = await worker.recognize(imageSource);
  console.log("OCR Result:");
  console.log(text);

  const output = document.getElementById("ocr-result");
  if (output) output.textContent = text;

  return text;
}


function getCaptureRegion() {
  const videoRect = video.getBoundingClientRect();
  const width = video.videoWidth;
  const height = video.videoHeight;

  if (width === 0 || height === 0) {
    return null;
  }

  const cropWidth = Math.floor(width * 0.8);
  const cropHeight = Math.floor(height * 0.7);
  const x = Math.floor((width - cropWidth) / 2);
  const y = Math.floor((height - cropHeight) / 2);

  return { x, y, width: cropWidth, height: cropHeight };
}

async function captureFrame() {
  const region = getCaptureRegion();
  if (!region) {
    setStatus('Video not ready. Please start the camera again.');
    return null;
  }

  canvas.width = region.width;
  canvas.height = region.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
  return canvas.toDataURL('image/png');
}

async function handleCapture() {
  setStatus('Capturing card image...');
  const imageData = await captureFrame();
  if (!imageData) return;

  setStatus('Recognizing card text...');
  const text = await recognizeCardImage(imageData);
  if (!text) {
    ocrResult.textContent = 'No text detected. Try another capture.';
    cardNameElement.textContent = '';
    updateSearchLinks('');
    return;
  }

  ocrResult.textContent = text;
  const cardName = extractCardName(text);
  if (cardName) {
    const matchedCard = findCardMatch(cardName);
    if (matchedCard) {
      cardNameElement.innerHTML = `Card matched from Spider-Man set: <strong>${matchedCard.name}</strong><br />` +
        `Type: ${matchedCard.type}<br />` +
        `Mana cost: ${matchedCard.manaCost || 'N/A'}<br />` +
        `Text: ${matchedCard.text}`;
      updateSearchLinks(matchedCard.name);
      setStatus('Card matched to the Spider-Man database.');
    } else {
      cardNameElement.textContent = `Card name candidate: ${cardName}`;
      updateSearchLinks(cardName);
      setStatus('Card recognized, but not yet matched to the Spider-Man set database.');
    }
  } else {
    cardNameElement.textContent = 'Unable to identify a clear card name from the OCR output.';
    updateSearchLinks('');
    setStatus('OCR finished, but the card name was not confidently detected.');
  }
}

function stopCamera() {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  stream = null;
  captureButton.disabled = true;
  setStatus('Camera stopped. You can upload an image or start the camera again.');
}

async function startCamera() {
  if (stream) {
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream;
    captureButton.disabled = false;
    setStatus('Camera started. Position the card inside the frame and tap Capture.');
  } catch (error) {
    console.error(error);
    setStatus('Unable to access camera. Please allow camera access or upload a photo instead.');
  }
}

async function handleUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async (e) => {
    const imageData = e.target.result;

    // Debug logs so we can see what’s happening
    console.log("Image data length:", imageData?.length);
    console.log("Image data prefix:", imageData?.substring(0, 50));

    setStatus("Recognizing text from uploaded image...");

    const text = await runOCR(imageData);

    if (!text) {
      ocrResult.textContent = "No text detected in the uploaded image.";
      cardNameElement.textContent = "";
      updateSearchLinks("");
      return;
    }

    ocrResult.textContent = text;

    const cardName = extractCardName(text);
    if (cardName) {
      const matchedCard = findCardMatch(cardName);
      if (matchedCard) {
        cardNameElement.innerHTML =
          `Card matched from Spider-Man set: <strong>${matchedCard.name}</strong><br />` +
          `Type: ${matchedCard.type}<br />` +
          `Mana cost: ${matchedCard.manaCost || "N/A"}<br />` +
          `Text: ${matchedCard.text}`;
        updateSearchLinks(matchedCard.name);
        setStatus("Uploaded image matched to the Spider-Man database.");
      } else {
        cardNameElement.textContent = `Card name candidate: ${cardName}`;
        updateSearchLinks(cardName);
        setStatus("Upload scan finished. Use the search links to verify the card details.");
      }
    } else {
      cardNameElement.textContent = "Unable to identify a clear card name from the OCR output.";
      updateSearchLinks("");
      setStatus("Upload finished, but the card name was not confidently detected.");
    }
  };

  reader.readAsDataURL(file);
}

startCameraButton.addEventListener('click', startCamera);
captureButton.addEventListener('click', handleCapture);
uploadInput.addEventListener('change', handleUpload);

window.addEventListener('beforeunload', stopCamera);
