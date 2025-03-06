import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  styled,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Box,
  Divider,
  Button
} from '@mui/material';

interface EditableTableProps {
  data: string[][];
  onSave: (data: string[][], row: number, col: number) => void;
}

interface EditingCell {
  row: number;
  col: number;
}

interface CellSpan {
  rowSpan: number;
  colSpan: number;
}

// Map to track merged cells
type SpanMap = Record<string, CellSpan>;

// Styled components for Excel-like appearance
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  border: '1px solid #e0e0e0',
  padding: '8px',
  position: 'relative',
  minWidth: '100px',
  '&:hover': {
    backgroundColor: '#f5f5f5',
  },
  '&.editing': {
    padding: '0',
    border: '2px solid #1976d2',
  },
  '&.selected': {
    backgroundColor: '#e3f2fd',
  }
}));

const EditInput = styled('input')(({ theme }) => ({
  width: '100%',
  height: '100%',
  padding: '8px',
  border: 'none',
  outline: 'none',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  backgroundColor: 'white',
}));

const RowHeaderCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: '#f8f9fa',
  fontWeight: 'bold',
  color: '#495057',
  borderRight: '2px solid #dee2e6',
  width: '40px',
  textAlign: 'center',
  padding: '4px',
}));

const ColumnHeaderCell = styled(StyledTableCell)(({ theme }) => ({
  backgroundColor: '#f8f9fa',
  fontWeight: 'bold',
  color: '#495057',
  borderBottom: '2px solid #dee2e6',
  textAlign: 'center',
  padding: '4px',
}));

const CornerCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: '#f8f9fa',
  borderBottom: '2px solid #dee2e6',
  borderRight: '2px solid #dee2e6',
  width: '40px',
  padding: '4px',
}));

const TableActionButton = styled(Button)(({ theme }) => ({
  padding: '2px 8px',
  minWidth: 'unset',
  fontSize: '0.75rem',
  marginLeft: '4px',
}));

export const EditableTable: React.FC<EditableTableProps> = ({ data, onSave }) => {
  const [tableData, setTableData] = useState<string[][]>(data);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [selectedCell, setSelectedCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [spanMap, setSpanMap] = useState<SpanMap>({});
  
  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuPosition, setMenuPosition] = useState<{row: number, col: number} | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTableData(data);
  }, [data]);

  // Handle cell click for selection
  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col });
  };

  // Handle double click to start editing
  const handleDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col });
    setEditValue(tableData[row][col]);
  };

  // Handle cell edit save
  const handleSave = (row: number, col: number) => {
    if (editValue !== tableData[row][col]) {
      const newData = tableData.map((r, rowIndex) =>
        rowIndex === row
          ? r.map((cell, colIndex) => (colIndex === col ? editValue : cell))
          : r
      );
      setTableData(newData);
      onSave(newData, row, col);
    }
    setEditingCell(null);
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSave(editingCell.row, editingCell.col);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingCell(null);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleSave(editingCell.row, editingCell.col);
        // Move to next cell
        const nextCol = editingCell.col + (e.shiftKey ? -1 : 1);
        if (nextCol >= 0 && nextCol < tableData[0].length) {
          setEditingCell({ row: editingCell.row, col: nextCol });
          setEditValue(tableData[editingCell.row][nextCol]);
        }
      }
    } else if (selectedCell && !editingCell) {
      // Navigation when not editing
      const { row, col } = selectedCell;
      switch (e.key) {
        case 'ArrowUp':
          if (row > 0) setSelectedCell({ row: row - 1, col });
          break;
        case 'ArrowDown':
          if (row < tableData.length - 1) setSelectedCell({ row: row + 1, col });
          break;
        case 'ArrowLeft':
          if (col > 0) setSelectedCell({ row, col: col - 1 });
          break;
        case 'ArrowRight':
          if (col < tableData[0].length - 1) setSelectedCell({ row, col: col + 1 });
          break;
        case 'Enter':
          handleDoubleClick(row, col);
          break;
      }
    }
  };

  // Context menu handlers
  const handleContextMenu = (event: React.MouseEvent, row: number, col: number) => {
    event.preventDefault();
    setMenuPosition({ row, col });
    setMenuAnchorEl(event.currentTarget as HTMLElement);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuPosition(null);
  };

  // Row operations
  const addRow = (position: 'before' | 'after') => {
    if (!selectedCell) return;
    
    const { row } = selectedCell;
    const insertIndex = position === 'before' ? row : row + 1;
    const emptyRow = Array(tableData[0].length).fill('');
    
    const newData = [
      ...tableData.slice(0, insertIndex),
      emptyRow,
      ...tableData.slice(insertIndex)
    ];
    
    setTableData(newData);
    onSave(newData, insertIndex, 0);
    handleMenuClose();
  };

  const deleteRow = () => {
    if (!selectedCell || tableData.length <= 1) return;
    
    const { row } = selectedCell;
    const newData = tableData.filter((_, index) => index !== row);
    
    setTableData(newData);
    onSave(newData, row, 0);
    setSelectedCell(null);
    handleMenuClose();
  };

  // Column operations
  const addColumn = (position: 'before' | 'after') => {
    if (!selectedCell) return;
    
    const { col } = selectedCell;
    const insertIndex = position === 'before' ? col : col + 1;
    
    const newData = tableData.map(row => [
      ...row.slice(0, insertIndex),
      '',
      ...row.slice(insertIndex)
    ]);
    
    setTableData(newData);
    onSave(newData, 0, insertIndex);
    handleMenuClose();
  };

  const deleteColumn = () => {
    if (!selectedCell || tableData[0].length <= 1) return;
    
    const { col } = selectedCell;
    const newData = tableData.map(row => row.filter((_, index) => index !== col));
    
    setTableData(newData);
    onSave(newData, 0, col);
    setSelectedCell(null);
    handleMenuClose();
  };

  // Cell merging
  const mergeCells = () => {
    if (!selectedCell) return;
    
    // For simplicity, we'll just merge the selected cell with the one to its right
    const { row, col } = selectedCell;
    if (col < tableData[0].length - 1) {
      const key = `${row}-${col}`;
      const currentSpan = spanMap[key] || { rowSpan: 1, colSpan: 1 };
      
      setSpanMap({
        ...spanMap,
        [key]: { 
          ...currentSpan,
          colSpan: currentSpan.colSpan + 1 
        },
        [`${row}-${col+1}`]: { rowSpan: 0, colSpan: 0 } // Hide this cell
      });
      
      handleMenuClose();
    }
  };

  const unmergeCells = () => {
    if (!selectedCell) return;
    
    const { row, col } = selectedCell;
    const key = `${row}-${col}`;
    
    if (spanMap[key]) {
      // Create a new span map without the merged cells
      const newSpanMap = { ...spanMap };
      delete newSpanMap[key];
      
      // Also remove any hidden cells related to this merge
      for (let r = 0; r < tableData.length; r++) {
        for (let c = 0; c < tableData[0].length; c++) {
          const cellKey = `${r}-${c}`;
          if (newSpanMap[cellKey] && newSpanMap[cellKey].rowSpan === 0) {
            delete newSpanMap[cellKey];
          }
        }
      }
      
      setSpanMap(newSpanMap);
      handleMenuClose();
    }
  };

  // Check if a cell is hidden (part of a merge)
  const isCellHidden = (row: number, col: number) => {
    const key = `${row}-${col}`;
    return spanMap[key] && spanMap[key].rowSpan === 0;
  };

  // Get cell span properties
  const getCellSpan = (row: number, col: number) => {
    const key = `${row}-${col}`;
    return spanMap[key] || { rowSpan: 1, colSpan: 1 };
  };

  return (
    <TableContainer 
      component={Paper} 
      sx={{ 
        maxHeight: '70vh', 
        overflow: 'auto',
        '& .MuiTable-root': {
          borderCollapse: 'collapse',
          border: '1px solid #e0e0e0',
        }
      }}
      ref={tableRef}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1, bgcolor: '#f8f9fa' }}>
        <TableActionButton 
          variant="outlined" 
          size="small" 
          onClick={() => selectedCell && addRow('after')}
          disabled={!selectedCell}
        >
          + Row
        </TableActionButton>
        <TableActionButton 
          variant="outlined" 
          size="small" 
          onClick={deleteRow}
          disabled={!selectedCell || tableData.length <= 1}
          color="error"
        >
          - Row
        </TableActionButton>
        <TableActionButton 
          variant="outlined" 
          size="small" 
          onClick={() => selectedCell && addColumn('after')}
          disabled={!selectedCell}
        >
          + Column
        </TableActionButton>
        <TableActionButton 
          variant="outlined" 
          size="small" 
          onClick={deleteColumn}
          disabled={!selectedCell || tableData[0].length <= 1}
          color="error"
        >
          - Column
        </TableActionButton>
        <TableActionButton 
          variant="outlined" 
          size="small" 
          onClick={mergeCells}
          disabled={!selectedCell}
        >
          Merge
        </TableActionButton>
        <TableActionButton 
          variant="outlined" 
          size="small" 
          onClick={unmergeCells}
          disabled={!selectedCell}
        >
          Unmerge
        </TableActionButton>
      </Box>
      
      <Table stickyHeader onKeyDown={handleKeyDown}>
        <TableHead>
          <TableRow>
            <CornerCell>
              {/* Corner cell */}
            </CornerCell>
            {tableData[0]?.map((_, index) => (
              <ColumnHeaderCell key={index}>
                {String.fromCharCode(65 + index)}
              </ColumnHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {tableData.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              <RowHeaderCell>{rowIndex + 1}</RowHeaderCell>
              {row.map((cell, colIndex) => {
                // Skip rendering if this cell is hidden (part of a merge)
                if (isCellHidden(rowIndex, colIndex)) return null;
                
                const { rowSpan, colSpan } = getCellSpan(rowIndex, colIndex);
                
                return (
                  <StyledTableCell 
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)}
                    onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}
                    className={`
                      ${editingCell?.row === rowIndex && editingCell?.col === colIndex ? 'editing' : ''}
                      ${selectedCell?.row === rowIndex && selectedCell?.col === colIndex ? 'selected' : ''}
                    `}
                    tabIndex={0}
                    rowSpan={rowSpan}
                    colSpan={colSpan}
                  >
                    {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                      <EditInput
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSave(rowIndex, colIndex)}
                      />
                    ) : (
                      cell
                    )}
                  </StyledTableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => addRow('before')}>Insert Row Above</MenuItem>
        <MenuItem onClick={() => addRow('after')}>Insert Row Below</MenuItem>
        <MenuItem onClick={deleteRow}>Delete Row</MenuItem>
        <Divider />
        <MenuItem onClick={() => addColumn('before')}>Insert Column Left</MenuItem>
        <MenuItem onClick={() => addColumn('after')}>Insert Column Right</MenuItem>
        <MenuItem onClick={deleteColumn}>Delete Column</MenuItem>
        <Divider />
        <MenuItem onClick={mergeCells}>Merge Cells</MenuItem>
        <MenuItem onClick={unmergeCells}>Unmerge Cells</MenuItem>
      </Menu>
    </TableContainer>
  );
};