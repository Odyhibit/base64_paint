// Constants
const DEFAULT_COLS = 32;
const DEFAULT_ROWS = 32;
const DEFAULT_CELL_SIZE = 16;
const MIN_CELL_SIZE = 4;
const MAX_CELL_SIZE = 64;
const MIN_GRID_SIZE = 1;
const MAX_GRID_SIZE = 256;
const MAX_HISTORY = 50;

// Tool modes
const TOOL_DRAW = 'draw';
const TOOL_FILL = 'fill';

// State management
class EditorState {
  constructor() {
    this.cols = DEFAULT_COLS;
    this.rows = DEFAULT_ROWS;
    this.cellSize = DEFAULT_CELL_SIZE;
    this.pixels = this.createEmptyGrid(this.rows, this.cols);
    this.history = [];
    this.historyIndex = -1;
    this.drawing = false;
    this.drawMode = 1; // 1 = draw, 0 = erase
    this.lastCell = {};
    this.currentTool = TOOL_DRAW;
    this.showGrid = true;
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.output = document.getElementById('output');

    this.initCanvas();
    this.saveState();
  }

  createEmptyGrid(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
  }

  initCanvas() {
    this.canvas.width = this.cols * this.cellSize;
    this.canvas.height = this.rows * this.cellSize;
  }

  saveState() {
    // Remove any future states if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add current state
    this.history.push({
      pixels: this.pixels.map(row => [...row]),
      cols: this.cols,
      rows: this.rows
    });

    // Limit history size
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    this.updateUndoRedoButtons();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreState(this.history[this.historyIndex]);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreState(this.history[this.historyIndex]);
    }
  }

  restoreState(state) {
    this.pixels = state.pixels.map(row => [...row]);
    this.cols = state.cols;
    this.rows = state.rows;
    this.initCanvas();
    this.updateInputFields();
    this.updateUndoRedoButtons();
  }

  updateUndoRedoButtons() {
    document.getElementById('undoBtn').disabled = this.historyIndex <= 0;
    document.getElementById('redoBtn').disabled = this.historyIndex >= this.history.length - 1;
  }

  updateInputFields() {
    document.getElementById('inputCols').value = this.cols;
    document.getElementById('inputRows').value = this.rows;
  }

  resize(newCols, newRows) {
    if (newCols < MIN_GRID_SIZE || newRows < MIN_GRID_SIZE ||
        newCols > MAX_GRID_SIZE || newRows > MAX_GRID_SIZE) {
      alert(`Grid size must be between ${MIN_GRID_SIZE} and ${MAX_GRID_SIZE}`);
      return;
    }

    const newPixels = Array.from({ length: newRows }, (_, y) =>
      Array.from({ length: newCols }, (_, x) =>
        (y < this.rows && x < this.cols) ? this.pixels[y][x] : 0
      )
    );

    this.cols = newCols;
    this.rows = newRows;
    this.pixels = newPixels;
    this.initCanvas();
    this.saveState();
  }

  setCellSize(newSize) {
    this.cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, newSize));
    this.initCanvas();
  }

  clear() {
    this.pixels = this.createEmptyGrid(this.rows, this.cols);
    this.saveState();
  }

  invert() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.pixels[y][x] = this.pixels[y][x] ? 0 : 1;
      }
    }
    this.saveState();
  }

  moveUp() {
    if (this.rows <= 1) return;
    const topRow = this.pixels[0].slice();
    for (let y = 0; y < this.rows - 1; y++) {
      this.pixels[y] = this.pixels[y + 1].slice();
    }
    this.pixels[this.rows - 1] = topRow;
    this.saveState();
  }

  moveDown() {
    if (this.rows <= 1) return;
    const bottomRow = this.pixels[this.rows - 1].slice();
    for (let y = this.rows - 1; y > 0; y--) {
      this.pixels[y] = this.pixels[y - 1].slice();
    }
    this.pixels[0] = bottomRow;
    this.saveState();
  }

  moveLeft() {
    if (this.cols <= 1) return;
    for (let y = 0; y < this.rows; y++) {
      const leftmost = this.pixels[y][0];
      for (let x = 0; x < this.cols - 1; x++) {
        this.pixels[y][x] = this.pixels[y][x + 1];
      }
      this.pixels[y][this.cols - 1] = leftmost;
    }
    this.saveState();
  }

  moveRight() {
    if (this.cols <= 1) return;
    for (let y = 0; y < this.rows; y++) {
      const rightmost = this.pixels[y][this.cols - 1];
      for (let x = this.cols - 1; x > 0; x--) {
        this.pixels[y][x] = this.pixels[y][x - 1];
      }
      this.pixels[y][0] = rightmost;
    }
    this.saveState();
  }

  rotate90Clockwise() {
    const newPixels = Array.from({ length: this.cols }, () => Array(this.rows).fill(0));
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        newPixels[x][this.rows - 1 - y] = this.pixels[y][x];
      }
    }
    [this.cols, this.rows] = [this.rows, this.cols];
    this.pixels = newPixels;
    this.initCanvas();
    this.updateInputFields();
    this.saveState();
  }

  floodFill(startX, startY) {
    const targetValue = this.pixels[startY][startX];
    const fillValue = targetValue ? 0 : 1;

    if (targetValue === fillValue) return;

    const stack = [[startX, startY]];
    const visited = new Set();

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) continue;
      if (this.pixels[y][x] !== targetValue) continue;

      visited.add(key);
      this.pixels[y][x] = fillValue;

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    this.saveState();
  }

  setTool(tool) {
    this.currentTool = tool;
    this.updateToolButtons();
    this.updateCursor();
    this.updateModeIndicator();
  }

  updateToolButtons() {
    document.querySelectorAll('#toolControls button').forEach(btn => {
      btn.classList.remove('active');
    });
    if (this.currentTool === TOOL_DRAW) {
      document.getElementById('drawToolBtn').classList.add('active');
    } else if (this.currentTool === TOOL_FILL) {
      document.getElementById('fillToolBtn').classList.add('active');
    }
  }

  updateCursor() {
    if (this.currentTool === TOOL_FILL) {
      this.canvas.classList.add('fill-mode');
    } else {
      this.canvas.classList.remove('fill-mode');
    }
  }

  updateModeIndicator() {
    const indicator = document.getElementById('modeIndicator');
    indicator.className = '';

    if (this.currentTool === TOOL_FILL) {
      indicator.textContent = '🪣 Fill Tool';
      indicator.classList.add('filling');
    } else if (this.drawMode === 1) {
      indicator.textContent = '✏️ Drawing';
      indicator.classList.add('drawing');
    } else {
      indicator.textContent = '🧹 Erasing';
      indicator.classList.add('erasing');
    }
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
  }

  exportToBase64() {
    let bits = '';
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        bits += this.pixels[y][x];
      }
    }

    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8).padEnd(8, '0'), 2));
    }

    const arr = new Uint8Array(bytes);
    let bin = '';
    arr.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  }

  loadFromBase64(str) {
    let raw;
    try {
      raw = atob(str);
    } catch (e) {
      throw new Error('Invalid Base64 string');
    }

    let bits = '';
    for (let i = 0; i < raw.length; i++) {
      bits += raw.charCodeAt(i).toString(2).padStart(8, '0');
    }

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const idx = y * this.cols + x;
        this.pixels[y][x] = idx < bits.length ? +bits[idx] : 0;
      }
    }

    this.saveState();
  }

  exportToPNG() {
    // Create a temporary canvas without grid lines
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.cols * this.cellSize;
    tempCanvas.height = this.rows * this.cellSize;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw white background
    tempCtx.fillStyle = '#fff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw pixels
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.pixels[y][x]) {
          tempCtx.fillStyle = '#000';
          tempCtx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
        }
      }
    }

    return tempCanvas.toDataURL('image/png');
  }
}

// Drawing functionality
class DrawingController {
  constructor(state) {
    this.state = state;
    this.setupEventListeners();
  }

  getCell(evt) {
    const r = this.state.canvas.getBoundingClientRect();
    const clientX = evt.clientX || (evt.touches && evt.touches[0]?.clientX);
    const clientY = evt.clientY || (evt.touches && evt.touches[0]?.clientY);

    return {
      x: Math.floor((clientX - r.left) / this.state.cellSize),
      y: Math.floor((clientY - r.top) / this.state.cellSize)
    };
  }

  handleStart(evt) {
    evt.preventDefault();

    const { x, y } = this.getCell(evt);

    if (y < 0 || y >= this.state.rows || x < 0 || x >= this.state.cols) return;

    if (this.state.currentTool === TOOL_FILL) {
      this.state.floodFill(x, y);
      this.draw();
      return;
    }

    this.state.drawMode = this.state.pixels[y][x] ? 0 : 1;
    this.state.drawing = true;
    this.state.lastCell = { x, y };
    this.state.pixels[y][x] = this.state.drawMode;
    this.state.updateModeIndicator();
    this.draw();
  }

  handleMove(evt) {
    if (!this.state.drawing) return;
    evt.preventDefault();

    const { x, y } = this.getCell(evt);

    if (y < 0 || y >= this.state.rows || x < 0 || x >= this.state.cols) return;

    if ((x !== this.state.lastCell.x || y !== this.state.lastCell.y) &&
        this.state.pixels[y][x] !== this.state.drawMode) {
      this.state.pixels[y][x] = this.state.drawMode;
      this.state.lastCell = { x, y };
      this.draw();
    }
  }

  handleEnd() {
    if (this.state.drawing) {
      this.state.drawing = false;
      this.state.saveState();
    }
  }

  setupEventListeners() {
    // Mouse events
    this.state.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
    this.state.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
    this.state.canvas.addEventListener('mouseup', () => this.handleEnd());
    this.state.canvas.addEventListener('mouseleave', () => this.handleEnd());

    // Touch events
    this.state.canvas.addEventListener('touchstart', (e) => this.handleStart(e));
    this.state.canvas.addEventListener('touchmove', (e) => this.handleMove(e));
    this.state.canvas.addEventListener('touchend', () => this.handleEnd());
    this.state.canvas.addEventListener('touchcancel', () => this.handleEnd());
  }

  draw() {
    const ctx = this.state.ctx;
    const cellSize = this.state.cellSize;
    const cols = this.state.cols;
    const rows = this.state.rows;
    const pixels = this.state.pixels;

    ctx.clearRect(0, 0, this.state.canvas.width, this.state.canvas.height);

    // Draw white background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, this.state.canvas.width, this.state.canvas.height);

    // Draw pixels
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (pixels[y][x]) {
          ctx.fillStyle = '#000';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw grid
    if (this.state.showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;

      for (let i = 0; i <= cols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, rows * cellSize);
        ctx.stroke();
      }

      for (let i = 0; i <= rows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(cols * cellSize, i * cellSize);
        ctx.stroke();
      }
    }
  }
}

// URL parameter handling
function loadFromURL(state) {
  const params = new URLSearchParams(window.location.search);

  if (params.has('w')) {
    const w = parseInt(params.get('w'));
    if (w >= MIN_GRID_SIZE && w <= MAX_GRID_SIZE) {
      state.cols = w;
    }
  }

  if (params.has('h')) {
    const h = parseInt(params.get('h'));
    if (h >= MIN_GRID_SIZE && h <= MAX_GRID_SIZE) {
      state.rows = h;
    }
  }

  state.initCanvas();
  state.pixels = state.createEmptyGrid(state.rows, state.cols);
  state.updateInputFields();

  if (params.has('data')) {
    try {
      state.loadFromBase64(params.get('data'));
    } catch (e) {
      console.error('Failed to load data from URL:', e);
    }
  }
}

function updateURL(state) {
  const base64 = state.exportToBase64();
  const url = new URL(window.location);
  url.searchParams.set('data', base64);
  url.searchParams.set('w', state.cols);
  url.searchParams.set('h', state.rows);
  window.history.replaceState({}, '', url);
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  const state = new EditorState();
  const drawer = new DrawingController(state);

  // Load from URL if present
  loadFromURL(state);
  drawer.draw();

  // Control buttons
  document.getElementById('resizeBtn').addEventListener('click', () => {
    const newCols = parseInt(document.getElementById('inputCols').value);
    const newRows = parseInt(document.getElementById('inputRows').value);
    state.resize(newCols, newRows);
    drawer.draw();
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Clear the entire canvas?')) {
      state.clear();
      drawer.draw();
    }
  });

  document.getElementById('invertBtn').addEventListener('click', () => {
    state.invert();
    drawer.draw();
  });

  document.getElementById('undoBtn').addEventListener('click', () => {
    state.undo();
    drawer.draw();
  });

  document.getElementById('redoBtn').addEventListener('click', () => {
    state.redo();
    drawer.draw();
  });

  // Movement controls
  document.getElementById('upBtn').addEventListener('click', () => {
    state.moveUp();
    drawer.draw();
  });

  document.getElementById('downBtn').addEventListener('click', () => {
    state.moveDown();
    drawer.draw();
  });

  document.getElementById('leftBtn').addEventListener('click', () => {
    state.moveLeft();
    drawer.draw();
  });

  document.getElementById('rightBtn').addEventListener('click', () => {
    state.moveRight();
    drawer.draw();
  });

  document.getElementById('rotateBtn').addEventListener('click', () => {
    state.rotate90Clockwise();
    drawer.draw();
  });

  // Tool controls
  document.getElementById('drawToolBtn').addEventListener('click', () => {
    state.setTool(TOOL_DRAW);
  });

  document.getElementById('fillToolBtn').addEventListener('click', () => {
    state.setTool(TOOL_FILL);
  });

  // Zoom controls
  document.getElementById('zoomInBtn').addEventListener('click', () => {
    state.setCellSize(state.cellSize + 4);
    drawer.draw();
    document.getElementById('zoomValue').textContent = `${state.cellSize}px`;
  });

  document.getElementById('zoomOutBtn').addEventListener('click', () => {
    state.setCellSize(state.cellSize - 4);
    drawer.draw();
    document.getElementById('zoomValue').textContent = `${state.cellSize}px`;
  });

  // Grid toggle
  document.getElementById('gridToggle').addEventListener('change', (e) => {
    state.toggleGrid();
    drawer.draw();
  });

  // Base64 controls
  document.getElementById('exportBtn').addEventListener('click', () => {
    state.output.value = state.exportToBase64();
    updateURL(state);
  });

  document.getElementById('loadBtn').addEventListener('click', () => {
    const str = state.output.value.trim();
    if (!str) {
      alert('Please paste Base64 data first');
      return;
    }
    try {
      state.loadFromBase64(str);
      drawer.draw();
      updateURL(state);
    } catch (e) {
      alert('Invalid Base64 data: ' + e.message);
    }
  });

  document.getElementById('copyBtn').addEventListener('click', async () => {
    const base64 = state.exportToBase64();
    try {
      await navigator.clipboard.writeText(base64);
      alert('Copied to clipboard!');
    } catch (e) {
      // Fallback for older browsers
      state.output.value = base64;
      state.output.select();
      document.execCommand('copy');
      alert('Copied to clipboard!');
    }
  });

  document.getElementById('downloadBtn').addEventListener('click', () => {
    const base64 = state.exportToBase64();
    const blob = new Blob([base64], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawing_${state.cols}x${state.rows}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('exportPNGBtn').addEventListener('click', () => {
    const dataUrl = state.exportToPNG();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `drawing_${state.cols}x${state.rows}.png`;
    a.click();
  });

  // Preset templates
  document.querySelectorAll('#presetControls button').forEach(btn => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.size.split('x');
      document.getElementById('inputCols').value = size[0];
      document.getElementById('inputRows').value = size[1];
      state.resize(parseInt(size[0]), parseInt(size[1]));
      drawer.draw();
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Prevent shortcuts when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      state.undo();
      drawer.draw();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      state.redo();
      drawer.draw();
    }
    // Arrow keys for movement
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.moveUp();
      drawer.draw();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.moveDown();
      drawer.draw();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      state.moveLeft();
      drawer.draw();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      state.moveRight();
      drawer.draw();
    }
    // Tool shortcuts
    else if (e.key === 'd' || e.key === 'D') {
      state.setTool(TOOL_DRAW);
    } else if (e.key === 'f' || e.key === 'F') {
      state.setTool(TOOL_FILL);
    }
    // Other shortcuts
    else if (e.key === 'r' || e.key === 'R') {
      state.rotate90Clockwise();
      drawer.draw();
    } else if (e.key === 'i' || e.key === 'I') {
      state.invert();
      drawer.draw();
    } else if (e.key === 'c' || e.key === 'C') {
      if (confirm('Clear the entire canvas?')) {
        state.clear();
        drawer.draw();
      }
    } else if (e.key === 'e' || e.key === 'E') {
      state.output.value = state.exportToBase64();
      updateURL(state);
    } else if (e.key === 'l' || e.key === 'L') {
      const str = state.output.value.trim();
      if (str) {
        try {
          state.loadFromBase64(str);
          drawer.draw();
          updateURL(state);
        } catch (e) {
          alert('Invalid Base64 data');
        }
      }
    } else if (e.key === 'g' || e.key === 'G') {
      document.getElementById('gridToggle').checked = !state.showGrid;
      state.toggleGrid();
      drawer.draw();
    }
  });
});
