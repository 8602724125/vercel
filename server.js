const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const sharp = require('sharp');
const bodyParser = require('body-parser')

const app = express();
const PORT = 3200;

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

// Enable CORS
app.use(cors());

// Set up the storage engine for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Save files to the "uploads" folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// Serve the "uploads" folder as static
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Define the upload endpoint
app.post("/upload", upload.single("upload"), (req, res) => {
  console.log('req: ', req);
  try {
    // Return the URL of the uploaded file
    const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    res.status(200).json({ url: fileUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to upload image" });
  }
});

app.post('/image', async (req, res) => {
  const { image } = req.body; // Base64 encoded PNG

  // Decode the base64 image and convert it to SVG
  const buffer = Buffer.from(image.split(',')[1], 'base64');
  const svgBuffer = await sharp(buffer).toFormat('svg').toBuffer();

  // Set the bucket name, folder name, and image name
  const bucketName = "yasa-admin_images";
  const folderName = "QuestionBank";
  const imgName = `${Date.now()}.svg`;
  const bucket = storage.bucket(bucketName);
  const blob = bucket.file(`${folderName}/${imgName}`);

  // Create a write stream to upload the SVG to Google Cloud Storage
  const blobStream = blob.createWriteStream({
    metadata: {
      contentType: 'image/svg+xml',
    },
  });

  blobStream.on('error', (err) => {
    console.error('Upload Error:', err);
    res.status(500).send('Error uploading SVG to Google Cloud Storage');
  });

  blobStream.on('finish', async () => {
    // Make the file publicly accessible
    await blob.makePublic();

    // Construct the public URL for the uploaded file
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${folderName}/${imgName}`;

    // Send the public URL in the response
    res.status(200).json({ message: 'SVG uploaded successfully', url: publicUrl });
  });

  // End the stream and upload the SVG buffer
  blobStream.end(svgBuffer);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
