import { useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import Stack from '@mui/material/Stack';

import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import BoltIcon from '@mui/icons-material/Bolt';

import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';


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

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);

    const filePreviews = files.map(file => ({
      url: URL.createObjectURL(file),
      name: file.name,
      id: crypto.randomUUID(), // unique id for each image
    }));

    // Append to existing previews instead of overwriting
    setPreviews(prev => [...prev, ...filePreviews]);

    // Reset the input value so the same file can be re-uploaded if needed
    event.target.value = '';
  };

  const handleClearPhotos = () => {
    // Revoke object URLs to avoid memory leaks
    previews.forEach(file => URL.revokeObjectURL(file.url));
    setPreviews([]);
  };

  const handleScanPhotos = () => {
    if (previews.length === 0) {
      setErrorMessage('No cards to scan!');
      setErrorOpen(true);

      // Auto-hide after 3 seconds
      setTimeout(() => {
        setErrorOpen(false);
      }, 3000);
      return;
    }

    setErrorOpen(false); // clear any previous error
    console.log('Scanning photos...');
    // Implement your scanning logic here
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
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={handleButtonClick} startIcon={<CloudUploadIcon />}>
          Upload from Camera Roll
        </Button>
        <Button variant="contained" color="secondary" onClick={handleCameraClick} startIcon={<PhotoCameraIcon />}>
          Take A Photo
        </Button>
        <Button variant="contained" color="error" onClick={handleClearPhotos} startIcon={<DeleteIcon />}>
          Clear All Photos
        </Button>
        <Button variant="contained" color="success" onClick={handleScanPhotos} startIcon={<BoltIcon />}>
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
          <Grid item xs={6} sm={4} md={3} key={file.id} sx={{ position: 'relative' }}>
            <Card>
              <CardMedia
                component="img"
                image={file.url}
                alt={file.name}
                sx={{ height: 200, objectFit: 'cover' }}
              />
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
