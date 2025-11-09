document.addEventListener('DOMContentLoaded', function() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const uploadForm = document.getElementById('uploadForm');
  const progressWrap = document.getElementById('uploadProgressWrap');
  const progressBar = document.getElementById('uploadProgress');
  const uploadAreaContent = document.getElementById('uploadAreaContent');
  const percentLabel = document.getElementById('uploadPercent');
  const uploadList = document.getElementById('uploadList');

  if (dropZone) {
    dropZone.addEventListener('click', function(e) {
      if (e.target && e.target.closest('label')) return;
      if (fileInput) fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', function() {
      if (this.files && this.files.length > 0) {
        uploadFilesPerFile(this.files);
      }
    });
  }

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, function(e){ e.preventDefault(); e.stopPropagation(); }, false);
  });

  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, unhighlight, false);
    });

    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        uploadFilesPerFile(files);
      }
    }, false);
  }

  function highlight(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone && dropZone.classList.add('bg-primary', 'bg-opacity-10');
  }

  function unhighlight(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone && dropZone.classList.remove('bg-primary', 'bg-opacity-10');
  }

  function uploadFilesPerFile(files) {
    if (progressWrap) progressWrap.style.display = 'none';
    if (percentLabel) percentLabel.textContent = '';

    if (!uploadList) return uploadFiles(files); 

    uploadList.innerHTML = '';
    uploadList.style.display = 'block';
    if (uploadAreaContent) uploadAreaContent.style.opacity = '0.85';

    const queue = Array.from(files);
    const maxConcurrent = 3;
    let active = 0;

    function startNext() {
      while (active < maxConcurrent && queue.length > 0) {
        const file = queue.shift();
        const row = createUploadRow(file);
        uploadList.appendChild(row.container);
        active++;
        processFileBeforeUpload(file).then((processed) => uploadSmart(processed, row)).finally(() => {
          active--;
          if (queue.length > 0) {
            startNext();
          } else if (active === 0) {
            setTimeout(() => window.location.reload(), 400);
          }
        });
      }
    }

    startNext();
  }

  function uploadFiles(files) {
    const formData = new FormData();

    for (let i = 0; i < files.length; i++) {
      formData.append('file', files[i]);
    }

    if (progressWrap) progressWrap.style.display = 'block';
    if (uploadAreaContent) uploadAreaContent.style.opacity = '0.7';
    if (progressBar) {
      progressBar.style.width = '0%';
      progressBar.classList.remove('bg-success', 'bg-danger');
      progressBar.classList.add('progress-bar-striped', 'progress-bar-animated');
      progressBar.setAttribute('aria-valuemin', '0');
      progressBar.setAttribute('aria-valuemax', '100');
      progressBar.setAttribute('aria-valuenow', '0');
    }
    if (percentLabel) percentLabel.textContent = '0%';

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = function(e) {
      if (!progressBar) return;
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = percent + '%';
        progressBar.setAttribute('aria-valuenow', String(percent));
        if (percentLabel) percentLabel.textContent = percent + '%';
      } else {
        progressBar.style.width = '100%';
        if (percentLabel) percentLabel.textContent = '';
      }
    };

    xhr.onload = function() {
      if (xhr.status === 200) {
        if (progressBar) {
          progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
          progressBar.classList.add('bg-success');
          progressBar.style.width = '100%';
          progressBar.setAttribute('aria-valuenow', '100');
        }
        if (percentLabel) percentLabel.textContent = '100%';
        setTimeout(() => { window.location.reload(); }, 400);
      } else {
        let msg = 'Upload failed. Please try again.';
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (data && data.error) msg = data.error;
        } catch (_) { /* ignore */ }
        showError(msg);
        resetUploadUI();
      }
    };

    xhr.onerror = function() {
      showError('An error occurred during upload.');
      resetUploadUI();
    };

    xhr.open('POST', '/FileAccess/upload', true);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send(formData);
  }

  function createUploadRow(file) {
    const container = document.createElement('div');
    container.className = 'mb-2';
    const name = document.createElement('div');
    name.className = 'd-flex justify-content-between align-items-center mb-1';
    const left = document.createElement('div');
    left.className = 'text-truncate';
    left.style.maxWidth = '85%';
    left.textContent = file.name;
    const right = document.createElement('small');
    right.className = 'text-muted';
    right.textContent = (file.size/1024/1024).toFixed(2) + ' MB';
    name.appendChild(left);
    name.appendChild(right);

    const progress = document.createElement('div');
    progress.className = 'progress';
    progress.style.height = '6px';
    const bar = document.createElement('div');
    bar.className = 'progress-bar bg-primary progress-bar-striped progress-bar-animated';
    bar.style.width = '0%';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', '0');
    progress.appendChild(bar);

    const status = document.createElement('small');
    status.className = 'text-muted';
    status.textContent = 'Uploading…';

    container.appendChild(name);
    container.appendChild(progress);
    container.appendChild(status);

    return { container, bar, status };
  }

  function uploadSmart(file, ui) {
    const CHUNK_THRESHOLD = 20 * 1024 * 1024; 
    if (file.size > CHUNK_THRESHOLD) {
      return uploadChunked(file, ui);
    }
    return uploadSingle(file, ui);
  }

  async function processFileBeforeUpload(file) {
    try {
      if (!/^image\/(jpeg|webp)$/i.test(file.type)) return file;
      if (file.size < 300 * 1024) return file;
      const bitmap = await createImageBitmap(file);
      const maxDim = 4096;
      let { width, height } = bitmap;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, width, height);
      const quality = 0.8;
      const blob = await new Promise(res => canvas.toBlob(res, file.type, quality));
      if (blob && blob.size < file.size) {
        return new File([blob], file.name, { type: file.type, lastModified: Date.now() });
      }
      return file;
    } catch (e) {
      return file;
    }
  }

  function uploadSingle(file, ui) {
    return new Promise((resolve) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = function(e) {
        if (!ui.bar) return;
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          ui.bar.style.width = percent + '%';
          ui.bar.setAttribute('aria-valuenow', String(percent));
        } else {
          ui.bar.style.width = '100%';
        }
      };
      xhr.onload = function() {
        ui.bar.classList.remove('progress-bar-animated', 'progress-bar-striped');
        if (xhr.status === 200) {
          ui.bar.classList.add('bg-success');
          ui.bar.style.width = '100%';
          ui.status.textContent = 'Done';
        } else if (xhr.status === 429) {
          ui.status.textContent = 'Rate limited, retrying…';
          setTimeout(() => {
            ui.bar.classList.add('progress-bar-animated', 'progress-bar-striped');
            uploadSingle(file, ui).then(resolve);
          }, 800);
          return;
        } else {
          let msg = 'Failed';
          try { const data = JSON.parse(xhr.responseText || '{}'); if (data && data.error) msg = data.error; } catch(_){}
          ui.bar.classList.remove('bg-primary');
          ui.bar.classList.add('bg-danger');
          ui.status.textContent = msg;
        }
        resolve();
      };
      xhr.onerror = function() {
        ui.bar.classList.remove('progress-bar-animated', 'progress-bar-striped', 'bg-primary');
        ui.bar.classList.add('bg-danger');
        ui.status.textContent = 'Network error';
        resolve();
      };
      xhr.open('POST', '/FileAccess/upload', true);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send(formData);
    });
  }

  function resetUploadUI() {
    if (progressWrap) progressWrap.style.display = 'none';
    if (progressBar) {
      progressBar.style.width = '0%';
      progressBar.classList.remove('bg-success', 'bg-danger', 'progress-bar-animated', 'progress-bar-striped');
      progressBar.setAttribute('aria-valuenow', '0');
    }
    if (uploadAreaContent) uploadAreaContent.style.opacity = '1';
    if (fileInput) fileInput.value = '';
    if (percentLabel) percentLabel.textContent = '';
  }

  function showError(message) {
    let alertDiv = document.querySelector('.upload-alert');
    const container = document.querySelector('.container.py-5');
    const uploadArea = document.querySelector('.upload-area');
    if (!container || !uploadArea) return alert(message);

    if (!alertDiv) {
      alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-danger alert-dismissible fade show upload-alert mt-3';
      alertDiv.setAttribute('role', 'alert');
      alertDiv.innerHTML = `
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        <span class="alert-message"></span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      `;
      container.insertBefore(alertDiv, uploadArea.nextSibling);
    }
    const span = alertDiv.querySelector('.alert-message');
    if (span) span.textContent = message;
  }

  document.addEventListener('click', async (e) => {
    const shareBtn = e.target.closest && e.target.closest('.copy-share');
    const copyBtn = e.target.closest && e.target.closest('.copy-link');
    if (shareBtn) {
      const id = shareBtn.getAttribute('data-id');
      try {
        const res = await fetch(`/FileAccess/share/${id}`, {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          credentials: 'same-origin',
          body: 'share=1'
        });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || ct.indexOf('application/json') === -1) {
          let msg = 'Failed to create share link';
          try { const t = await res.text(); if (t) msg = t; } catch(_){}
          alert(msg);
          return;
        }
        const data = await res.json();
        if (data && data.url) {
          await copyText(data.url);
          showCopied(shareBtn);
        } else {
          alert('Failed to create share link');
        }
      } catch (_) {
        alert('Failed to create share link');
      }
    } else if (copyBtn) {
      const token = copyBtn.getAttribute('data-token');
      const url = `${location.protocol}//${location.host}/FileAccess/public/${token}`;
      try {
        await copyText(url);
        showCopied(copyBtn);
      } catch (_) {
        alert('Failed to copy link');
      }
    }
  });

  function showTransientAlert(message) {
    const container = document.querySelector('.container.py-5');
    if (!container) return alert(message);
    const div = document.createElement('div');
    div.className = 'alert alert-success py-2 px-3 mt-2';
    div.textContent = message;
    container.prepend(div);
    setTimeout(() => { div.remove(); }, 1600);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
    return true;
  }

  function showCopied(el) {
    try {
      if (window.bootstrap && window.bootstrap.Tooltip) {
        const tip = new window.bootstrap.Tooltip(el, { title: 'Copied!', trigger: 'manual', placement: 'top' });
        tip.show();
        setTimeout(() => { try { tip.hide(); tip.dispose(); } catch(_){} }, 1000);
        return;
      }
    } catch(_) {}
    showTransientAlert('Link copied to clipboard');
  }
});
