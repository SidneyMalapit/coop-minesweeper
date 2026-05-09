import readline from 'readline';
import {
  cursorSavePosition,
  cursorRestorePosition,
  cursorGetPosition,
  cursorTo,
  cursorMove,
  eraseDown,
  scrollUp
} from 'ansi-escapes';
import chalk from 'chalk';
import { Grid, Cell, CellType } from './Minesweeper.js';

const markerColors = [
  chalk.red,
  chalk.green,
  chalk.blue,
  chalk.yellow,
  chalk.cyan,
  chalk.magenta
];

export function writeColumnMarkers(columnCount: number) {
  let out = '';
  for (let i = Math.floor(Math.log10(columnCount)); i >= 0; i--) {
    for (let j = 1; j <= columnCount; j++) {
      const fullNum = Math.floor(j / (10 ** i));
      const num = fullNum % 10;
      out += (j % 10 || !fullNum) && i > 0 ? ' ' : markerColors[Math.floor(j / 10) % markerColors.length]!(num);
    }
    out += cursorMove(-columnCount, 1);
  }
  return out;
}

export function writeRowMarkers(rowCount: number) {
  let out = '';
  for (let i = Math.floor(Math.log10(rowCount)); i >= 0; i--) {
    for (let j = 1; j <= rowCount; j++) {
      const num = Math.floor(j / (10 ** i)) % 10;
      out += (num === 0 && i > 0 ? ' ' : markerColors[Math.floor(j / 10) % markerColors.length]!(num)) + cursorMove(-1, 1);
    }
    out += cursorMove(1, -rowCount);
  }
  return out;
}

export function writeGrid(grid: Grid) {
  let out = '';
  for (let r = 0; r < grid.rowCount; r++) {
    for (let c = 0; c < grid.columnCount; c++) {
      const cell = grid.get(r, c);
      out += cellToChar(cell);
    }
    out += cursorMove(-grid.columnCount, 1);
  }
  return out;
}

const controlsHeight = writeControls().split('\n').length;
export function writeControls() {
  const slash = chalk.white('/');
  return chalk.white.bold('controls')
    + '\n'
    + chalk.red('h') + slash
    + chalk.red('j') + slash
    + chalk.red('k') + slash
    + chalk.red('l') + chalk.white(':') + ' '
    + chalk.white('move cursor left/down/up/right')
    + '\n\n'
    + chalk.red('w') + slash + chalk.red('b') + chalk.white(':') + ' '
    + chalk.white('move to next/previous horizontal unopened cell')
    + '\n'
    + chalk.red('W') + slash + chalk.red('B') + chalk.white(':') + ' '
    + chalk.white('move to next/previous vertical unopened cell')
    + '\n\n'
    + chalk.red('space') + chalk.white(':') + ' '
    + chalk.white('open cell (chord on opened cells)')
    + '\n'
    + chalk.red('f') + chalk.white(':') + ' '
    + chalk.white('toggle flag')
    + '\n'
    + chalk.red('!') + chalk.white(':') + ' '
    + chalk.white('rerender game (use if cursor wanders outside grid)');
}

export async function writeAll(grid: Grid, columnMarkerHeight: number, rowMarkerWidth: number, scrollUpCount: number) {

  return ''
    + scrollUp.repeat(scrollUpCount)
    + cursorMove(0, -scrollUpCount) // cursor doesn't move with scroll so must move manually
    + cursorSavePosition
    + cursorMove(rowMarkerWidth)
    + writeColumnMarkers(grid.columnCount)
    + cursorRestorePosition
    + cursorMove(0, columnMarkerHeight)
    + writeRowMarkers(grid.rowCount)
    + cursorRestorePosition
    + cursorMove(rowMarkerWidth, columnMarkerHeight)
    + writeGrid(grid)
    + cursorRestorePosition
    + cursorMove(0, columnMarkerHeight + grid.rowCount)
    + writeControls()
    + cursorRestorePosition
    + cursorMove(rowMarkerWidth, columnMarkerHeight);
}

const flagChar = chalk.bgYellowBright.black('f');
const mineChar = chalk.bgRed.black('X');
function cellToChar(cell: Cell) {
  switch (cell.type) {
    case CellType.Flag: return flagChar;
    case CellType.Unopened: return chalk.bgGray(' ');
    case CellType.Mine: return mineChar;
    case CellType.Numeral: return numericCellToChar(cell);
  }
}

function numericCellToChar(cell: Cell) {
  let color = chalk.bgBlack;
  switch (cell.count) {
    case 0: return color(' ');
    case 1: color = color.blueBright; break;
    case 2: color = color.green; break;
    case 3: color = color.redBright; break;
    case 4: color = color.blue; break;
    case 5: color = color.red; break;
    case 6: color = color.cyan; break;
    case 7: color = color.magenta; break;
    case 8: color = color.gray; break;
    default: return mineChar;
  }
  return color(cell.count);
}

function constrain(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// modified from https://stackoverflow.com/a/71367096
const getCursorPos = () => new Promise<{ rows: number, cols: number }>((resolve) => {
  const { isRaw } = process.stdin;

  process.stdin.setEncoding('utf8');
  process.stdin.setRawMode(true);

  const readfx = () => {
    const buf = process.stdin.read();
    const str = JSON.stringify(buf); // "\u001b[9;1R"
    const regex = /\[(.*)/g;
    const xy = regex.exec(str)![0].replace(/\[|R"/g, '').split(';');
    const pos = { rows: +xy[0]!, cols: +xy[1]! };
    process.stdin.setRawMode(isRaw);
    resolve(pos);
  };

  process.stdin.once('readable', readfx);
  process.stdout.write(cursorGetPosition);
});

const g = new Grid(40, 18, 99);

const columnMarkerHeight = Math.floor(Math.log10(g.columnCount)) + 1;
const rowMarkerWidth = Math.floor(Math.log10(g.rowCount)) + 2;

const totalHeight = g.rowCount + columnMarkerHeight + controlsHeight;

// only scroll if grid too big to fit in terminal
const scrollUpCount = Math.max(0, (await getCursorPos()).rows - process.stdout.rows + totalHeight);

process.stdout.write(await writeAll(g, columnMarkerHeight, rowMarkerWidth, scrollUpCount));

let home = await getCursorPos();

process.stdout.write(cursorMove(Math.floor(g.columnCount / 2), Math.floor(g.rowCount / 2)));

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

// map from char sequence to game action
const sequences = {
  'h': cursorMove(-1, 0),
  'j': cursorMove(0, 1),
  'k': cursorMove(0, -1),
  'l': cursorMove(1, 0),

  '!': async (grid: Grid) => {
    process.stdout.write(
      cursorTo(0, Math.min(home.rows, process.stdout.rows - totalHeight + 2) - columnMarkerHeight - 1) +
      eraseDown +
      await writeAll(grid, columnMarkerHeight, rowMarkerWidth, 0)
    );

    home = await getCursorPos();

    return '';
  },

  ' ': async (grid: Grid) => {
    const { rows: cursorRow, cols: cursorCol } = await getCursorPos();
    const gridRow = cursorRow - home.rows;
    const gridCol = cursorCol - home.cols;

    const { opened, cell } = grid.open(gridRow * grid.columnCount + gridCol);

    // chording
    if (!opened && cell.isOpen && cell.count > 0) {
      const neighbors = grid.getNeighborIndices(gridRow * grid.columnCount + gridCol);
      const flaggedNeighbors = neighbors.filter(i => grid.cells[i]!.type === CellType.Flag).length;
      if (flaggedNeighbors === cell.count) {
        for (const i of neighbors) { grid.open(i) }
      }
      return cursorSavePosition
        + cursorTo(home.cols - 1, home.rows - 1)
        + writeGrid(grid)
        + cursorRestorePosition;
    }

    if (!opened) { return ''; }
    if (cell.count !== 0) { return numericCellToChar(cell) + cursorMove(-1, 0); }

    return cursorSavePosition
      + cursorTo(home.cols - 1, home.rows - 1)
      + writeGrid(grid)
      + cursorRestorePosition;
  },

  'f': async (grid: Grid) => {
    if (!grid.isInitialized) { return ''; }

    const { rows: cursorRow, cols: cursorCol } = await getCursorPos();
    const gridRow = cursorRow - home.rows;
    const gridCol = cursorCol - home.cols;

    const cell = grid.get(gridRow, gridCol);
    cell.toggleFlag();

    return cellToChar(cell) + cursorMove(-1, 0);
  }
};

const moveKeys = 'h j k l r'.split(' ');
let queue = '';

// keypress consumption
process.stdin.on('keypress', async (str, key) => {
  if (key.ctrl && key.name === 'c') {
    process.stdout.write(cursorRestorePosition + cursorMove(0, totalHeight));
    return process.exit(); 
  }

  if (!str?.match(/^[ -~]$/)) { return; }
  queue += str;

  // match keypress to action
  for (const seq in sequences) {
    if (!queue.endsWith(seq)) { continue; }
    queue = '';

    const actionKey = seq as keyof typeof sequences;
    const action = sequences[actionKey];
    if (typeof action === 'string') { process.stdout.write(action); }
    else { process.stdout.write(await action(g)); }

    const { rows: cursorRow, cols: cursorCol } = await getCursorPos();
    const gridRow = cursorRow - home.rows;
    const gridCol = cursorCol - home.cols;

    // prevent cursor from moving outside of grid
    if (
      moveKeys.includes(actionKey) &&
      !g.withinBounds(gridRow, gridCol)
    ) {
      const constrainedCol = constrain(gridCol, 0, g.columnCount - 1) - 1;
      const constrainedRow = constrain(gridRow, 0, g.rowCount - 1) - 1;
      process.stdout.write(cursorTo(home.cols + constrainedCol, home.rows + constrainedRow));
    }

    break;
  }   
});
