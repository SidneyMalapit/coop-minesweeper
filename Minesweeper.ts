export class Grid {
  private readonly _cells: Cell[];
  public isInitialized = false;
  
  constructor(
    public readonly columnCount: number,
    public readonly rowCount: number,
    public readonly mineCount: number,
  ) {
    if (
      columnCount <= 0 ||
      rowCount <= 0 ||
      mineCount < 0 ||
      mineCount >= columnCount * rowCount
    ) {
      throw new Error(`Invalid grid parameters: width=${columnCount}, height=${rowCount}, mineCount=${mineCount}`);
    }
    
    this._cells = Array.from({ length: columnCount * rowCount }, () => new Cell);
  }

  get cells(): readonly Readonly<Cell>[] { return this._cells; }

  init(startRow: number, startCol: number) {
    // ensure first click and neighbors are not mines,
    // unless grid too small to accommodate
    const protectedCells: number[] =
      this.columnCount * this.rowCount - 9 <= this.mineCount ?
      [] :
      Array.from({ length: 9 }, (_, i) => {
        const row = startRow + Math.floor(i / 3) - 1;
        const col = startCol + (i % 3) - 1;
        return row * this.columnCount + col;
      });

    // mine placement
    for (let i = 0; i < this.mineCount; i++) {
      const mineIndex = Math.floor(Math.random() * (this.columnCount * this.rowCount));
      if (protectedCells.includes(mineIndex) || this._cells[mineIndex].isMine) {
        i--; continue;
      }
      this._cells[mineIndex].createMine();
      this.getNeighbors(mineIndex).forEach((neighbor) => neighbor?.increment());
    }

    // incrementing and mine creation must be complete by
    // this point
    this._cells.forEach((cell) => cell.prime());

    this.isInitialized = true;
  }

  /** @return game state after opening */
  open(index: number) {
    if (!this.isInitialized) { this.init(Math.floor(index / this.columnCount), index % this.columnCount); }

    const cell = this._cells[index];
    if (!cell) { throw new Error(`Invalid cell index: ${index}`); }
    if (!cell.open()) { return { opened: false, cell }; }
    if (cell.isMine || cell.count > 0) { return { opened: true, cell }; }

    const stack = this.getNeighborIndices(index);

    // cell is open, so open neighbors and their neighbors
    // unless neighbor is mine
    do {
      const index = stack.pop()!;
      const current = this._cells[index]!;

      // if current has mines around it, open current but
      // don't open neighbors
      if (!current.open() || current.count > 0) { continue; }

      stack.push(...this.getNeighborIndices(index));
    } while (stack.length > 0);

    return { opened: true, cell };
  }

  get(row: number, col: number, strict?: true): Cell;
  get(row: number, col: number, strict: false): Cell | null;
  get(row: number, col: number, strict = true) {
    if (!this.withinBounds(row, col)) {
      if (strict) { throw new Error(`Invalid cell position: (${row}, ${col})`); } 
      return null;
    }

    return this._cells[row * this.columnCount + col];
  }

  getNeighbors(index: number) {
    return this.getNeighborIndices(index).map((neighborIndex) => this._cells[neighborIndex]);
  }

  /**
   * iterate through 3x3 block centered on index not
   * including index itself or out of bounds indices
   */
  getNeighborIndices(index: number) {
    const row = Math.floor(index / this.columnCount);
    const col = index % this.columnCount;
    const neighbors: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) { continue; }
        const neighborRow = row + dr;
        const neighborCol = col + dc;
        if (
          neighborRow >= 0 &&
          neighborRow < this.rowCount &&
          neighborCol >= 0 &&
          neighborCol < this.columnCount
        ) {
          neighbors.push(neighborRow * this.columnCount + neighborCol);
        }
      }
    }
    return neighbors;
  }

  withinBounds(row: number, col: number) {
    return row >= 0 && row < this.rowCount && col >= 0 && col < this.columnCount;
  }
}

export enum CellType { Unopened, Flag, Mine, Numeral }

export class Cell {
  private _count = 0;
  private _isOpen = false;
  private _isFlag = false;
  private _isPrimed = false;

  get type() {
    if (this.isFlag) { return CellType.Flag; }
    if (!this.isOpen) { return CellType.Unopened; }
    if (this.isMine) { return CellType.Mine; }
    return CellType.Numeral;
  }
  
  increment() { 
    if (this._isPrimed) { throw new Error('Cannot increment count after priming'); }
    if (this.isMine) { return false; }
    this._count++;
    return true;
  }
  get count() { return this._count; }

  /**
   * cells should not be mutated after this function is
   * called
   */
  prime() { this._isPrimed = true; }
  get isPrimed() { return this._isPrimed; }

  toggleFlag() {
    if (this._isOpen) { return false; }
    this._isFlag = !this._isFlag;
    return true;
  }
  get isFlag() { return this._isFlag; }

  createMine() {
    if (this._isPrimed) { throw new Error('Cannot create mine after priming'); }
    this._count = -1; 
  }
  get isMine() { return this._count === - 1; }

  /** @return true if cell opens */
  open() {
    if (this._isOpen || this.isFlag) { return false; }
    return this._isOpen = true;
  }
  get isOpen() { return this._isOpen; }
}
