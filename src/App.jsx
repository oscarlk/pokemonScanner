import { useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';

import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import BoltIcon from '@mui/icons-material/Bolt';

import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';

import { heicTo } from "heic-to";

function App() {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [previews, setPreviews] = useState([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [errorOpen, setErrorOpen] = useState(false);

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current.click();
  };

  // const handleFileChange = (event) => {
  //   const files = Array.from(event.target.files);

  //   const filePreviews = files.map(file => ({
  //     url: URL.createObjectURL(file),
  //     name: file.name,
  //     id: crypto.randomUUID(), // unique id for each image
  //     file: file,
  //     scannedName: '',
  //     scannedDate: '',
  //     tcgLink: '',
  //     googleLink: '',
  //     isScanning: false,
  //   }));

  //   // Append to existing previews instead of overwriting
  //   setPreviews(prev => [...prev, ...filePreviews]);

  //   // Reset the input value so the same file can be re-uploaded if needed
  //   event.target.value = '';
  // };

  const handleFileChange = async (event) => {
      const files = Array.from(event.target.files);
  
      const filePreviews = await Promise.all(files.map(async (file) => {
          let previewUrl;
          let convertedFile = file;
  
          if (file.name.toLowerCase().endsWith('.heic')) {
              console.log("Converting HEIC to JPEG using heic-to...");
              try {
                  const convertedBlob = await heicTo({
                      blob: file,
                      toType: 'image/jpeg',
                      quality: 0.9,
                  });
  
                  previewUrl = URL.createObjectURL(convertedBlob);
  
                  convertedFile = new File(
                      [convertedBlob],
                      file.name.replace(/\.heic$/i, '.jpg'),
                      { type: 'image/jpeg' }
                  );
              } catch (err) {
                  console.error("HEIC conversion failed:", err);
                  previewUrl = ""; // fallback
              }
          } else {
              previewUrl = URL.createObjectURL(file);
          }
  
          return {
              url: previewUrl,
              name: convertedFile.name,
              id: crypto.randomUUID(),
              file: convertedFile,
              scannedName: '',
              scannedDate: '',
              tcgLink: '',
              googleLink: '',
              isScanning: false,
          };
      }));
  
      setPreviews(prev => [...prev, ...filePreviews]);
      event.target.value = '';
  };
  


  const handleClearPhotos = () => {
    // Revoke object URLs to avoid memory leaks
    previews.forEach(file => URL.revokeObjectURL(file.url));
    setPreviews([]);
  };

  const handleScanPhotos = async () => {
    if (previews.length === 0) {
      setErrorMessage('No cards to scan!');
      setErrorOpen(true);

      // Auto-hide after 3 seconds
      setTimeout(() => {
        setErrorOpen(false);
      }, 3000);
      return
    }

    setErrorOpen(false); // clear any previous error

    for (const fileObj of previews) {
      const formData = new FormData();
      formData.append('file', fileObj.file); // Ensure you save the File object in previews

      // ✅ Mark this card as scanning
      setPreviews(prev =>
        prev.map(p =>
          p.id === fileObj.id
            ? { ...p, isScanning: true }
            : p
        )
      );

      try {
        const res = await fetch('/api/scan-card', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        console.log(`Results for ${fileObj.name}:`, data);


        const tcgLink = data.name && data.name !== "Not found"
          ? `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(data.name)}&view=grid`
          : null;

        const googleLink = data.name && data.name !== "Not found"
          ? `https://www.google.com/search?q=site:tcgplayer.com+pokemon+${encodeURIComponent(data.name + " " + data.date)}`
          : null;

        // Update this preview entry with the scanned data
        setPreviews(prev =>
          prev.map(p =>
            p.id === fileObj.id
              ? { ...p, scannedName: data.name, scannedDate: data.date, tcgLink, googleLink, isScanning: false }
              : p
          )
        );

        // alert(`Scan Results:\nName: ${data.name}\nDate: ${data.date}`);
      } catch (err) {
        console.error('Error scanning photo:', err);
        setErrorMessage('Error scanning photo.');
        setErrorOpen(true);
        setTimeout(() => setErrorOpen(false), 3000);

        setPreviews(prev =>
          prev.map(p =>
            p.id === fileObj.id
              ? { ...p, isScanning: false }
              : p
          )
        );
      }
    }
  };

  const handleDeletePhoto = (id) => {
    setPreviews(prev => {
      const updated = prev.filter(file => file.id !== id);
      const removed = prev.find(file => file.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return updated;
    });
  };

  return (
    <div style={{ padding: 16 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Button variant="contained" onClick={handleButtonClick} startIcon={<CloudUploadIcon />} fullWidth>
          Upload from Camera Roll
        </Button>
        <Button variant="contained" color="secondary" onClick={handleCameraClick} startIcon={<PhotoCameraIcon />} fullWidth>
          Take A Photo
        </Button>
        <Button variant="contained" color="error" onClick={handleClearPhotos} startIcon={<DeleteIcon />} fullWidth>
          Clear All Photos
        </Button>
        <Button variant="contained" color="success" onClick={handleScanPhotos} startIcon={<BoltIcon />} fullWidth>
          Scan All Photos
        </Button>
      </Stack>

      {/* Upload from camera roll */}
      <input
        type="file"
        accept="image/*"
        multiple
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Take photo using camera */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <Collapse in={errorOpen}>
        <Alert
          severity="error"
          onClose={() => setErrorOpen(false)}
          sx={{ mt: 2 }}
        >
          {errorMessage}
        </Alert>
      </Collapse>
      <Grid container spacing={2} style={{ marginTop: 16 }}>
        {previews.map((file, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={file.id} sx={{ position: 'relative' }}>
            <Card>
              {file.isScanning && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    borderRadius: '50%',
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CircularProgress size={20} thickness={5} />
                </div>
              )}

              <CardMedia
                component="img"
                image={file.url}
                alt={file.name}
                sx={{ height: 200, objectFit: 'cover' }}
              />
              {(file.tcgLink || file.googleLink || file.scannedName) && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    borderRadius: 4,
                    padding: '4px 8px',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {file.scannedName && (
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.scannedName}
                    </div>
                  )}

                  {file.tcgLink && (
                    <Button
                      href={file.tcgLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="contained"
                      size="small"
                      sx={{
                        fontSize: 10,
                        padding: '2px 4px',
                        minWidth: 'unset',
                        alignSelf: 'start',
                      }}
                    >
                      TCG Search
                    </Button>
                  )}

                  {file.googleLink && (
                    <Button
                      href={file.googleLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outlined"
                      size="small"
                      sx={{
                        fontSize: 10,
                        padding: '2px 4px',
                        minWidth: 'unset',
                        alignSelf: 'start',
                        color: 'white',
                        borderColor: 'white',
                        '&:hover': { borderColor: 'white' }
                      }}
                    >
                      Google Search
                    </Button>
                  )}
                </div>
              )}
              <IconButton
                size="small"
                onClick={() => handleDeletePhoto(file.id)}
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' }
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Card>
          </Grid>
        ))}
      </Grid>
    </div>
  );
}

export default App;
