const fs = require('fs');
const file = 'src/app/finances/page.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Download icon
content = content.replace('Filter\n} from', 'Filter,\n  Download\n} from');

// 2. Add Start/End Date states
content = content.replace("const [txTypeFilter, setTxTypeFilter] = useState('all');", 
  "const [txTypeFilter, setTxTypeFilter] = useState('all');\n  const [startDate, setStartDate] = useState('');\n  const [endDate, setEndDate] = useState('');");

// 3. Add filtering logic before // --- Financial Metrics Calculations ---
const filterLogic = `
  const filteredSales = sales.filter(s => {
    if (startDate && new Date(s.sale_date) < new Date(startDate)) return false;
    if (endDate) {
      const adjustedEnd = new Date(endDate);
      adjustedEnd.setHours(23, 59, 59, 999);
      if (new Date(s.sale_date) > adjustedEnd) return false;
    }
    return true;
  });

  const filteredExpenses = expenses.filter(e => {
    if (startDate && new Date(e.expense_date) < new Date(startDate)) return false;
    if (endDate && new Date(e.expense_date) > new Date(endDate)) return false;
    return true;
  });

  const filteredPurchases = purchases.filter(p => {
    if (startDate && new Date(p.created_at) < new Date(startDate)) return false;
    if (endDate) {
      const adjustedEnd = new Date(endDate);
      adjustedEnd.setHours(23, 59, 59, 999);
      if (new Date(p.created_at) > adjustedEnd) return false;
    }
    return true;
  });
`;

content = content.replace('// --- Financial Metrics Calculations ---', filterLogic + '\n  // --- Financial Metrics Calculations ---');

// 4. Update Financial Metrics calculations to use filtered arrays
content = content.replace(
  "const revenueTotal = sales.reduce((sum, s) => sum + (s.total || 0), 0);",
  "const revenueTotal = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0);"
);
content = content.replace(
  "const expenseTotal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);",
  "const expenseTotal = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);"
);
content = content.replace(
  "const purchasesTotal = purchases.reduce((sum, p) => sum + (p.total || 0), 0);",
  "const purchasesTotal = filteredPurchases.reduce((sum, p) => sum + (p.total || 0), 0);"
);

// 5. Update compileTransactions to use filtered arrays
content = content.replace("sales.forEach(s => {", "filteredSales.forEach(s => {");
content = content.replace("expenses.forEach(e => {", "filteredExpenses.forEach(e => {");
content = content.replace("purchases.forEach(p => {", "filteredPurchases.forEach(p => {");

// 6. Add downloadLedgerReport function
const downloadLogic = `
  const downloadLedgerReport = () => {
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Transactions Ledger\\n";
    csv += \`Period: \${startDate || 'All Time'} to \${endDate || 'Present'}\\n\\n\`;
    csv += "Date,Transaction Reference,Flow Category,Description,Amount (GHS),Status\\n";

    compiledTxs.forEach(tx => {
      const isOutflow = tx.type === 'Outflow';
      const amtStr = \`\${isOutflow ? '-' : ''}\${tx.amount.toFixed(2)}\`;
      csv += \`\${new Date(tx.date).toLocaleDateString()},"\${tx.id}","\${tx.category}","\${tx.description.replace(/"/g, '""')}",\${amtStr},\${tx.status}\\n\`;
    });

    const encoded = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", \`honey_palace_ledger_\${Date.now()}.csv\`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
`;
content = content.replace('const compiledTxs = compileTransactions();', downloadLogic + '\n  const compiledTxs = compileTransactions();');

// 7. Light theme replacements (using exact strings)
content = content.replace(/bg-bg-dark/g, 'bg-bg-light');
content = content.replace(/bg-bg-card-hover\/20/g, 'bg-bg-light/50');
content = content.replace(/bg-bg-card-hover\/10/g, 'bg-bg-light/30');
content = content.replace(/bg-bg-card/g, 'bg-white');
content = content.replace(/text-white/g, 'text-black');
content = content.replace(/text-gray-300/g, 'text-gray-600');
content = content.replace(/text-text-muted/g, 'text-text-muted-dark');
content = content.replace(/border-gold\/10/g, 'border-black/5');
content = content.replace(/border-gold\/15/g, 'border-black/10');
content = content.replace(/text-bg-dark/g, 'text-black');
content = content.replace(/hover:text-white/g, 'hover:text-black');
content = content.replace(/text-gold/g, 'text-[#ffa200]');
content = content.replace(/bg-gold/g, 'bg-[#ffa200]');
content = content.replace(/shadow-xl/g, 'shadow-sm'); // Lighter shadows
content = content.replace(/border-transparent hover:text-black/g, 'border-transparent hover:text-gray-600');
content = content.replace(/bg-black\/60/g, 'bg-black/40'); // Lighter modal backdrop
content = content.replace(/border-gold/g, 'border-[#ffa200]');

// Add date filters to UI
const uiFilterStr = `
        {/* Actions Area */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div className="bg-white border border-black/5 p-4 rounded-xl flex flex-wrap gap-4 items-end shadow-sm flex-1 max-w-xl">
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-text-muted-dark font-semibold text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#ffa200]" /> Start Date
              </span>
              <input
                type="date"
                className="bg-bg-light border border-black/10 focus:border-[#ffa200] px-3 py-2 rounded-lg text-black font-semibold text-xs"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-text-muted-dark font-semibold text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#ffa200]" /> End Date
              </span>
              <input
                type="date"
                className="bg-bg-light border border-black/10 focus:border-[#ffa200] px-3 py-2 rounded-lg text-black font-semibold text-xs"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
`;

content = content.replace(`        {/* Actions Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 mb-4">

          <div className="flex gap-3">`, uiFilterStr);

// Add visual chart (simple CSS bar)
const chartHtml = `
        {/* Simple Cashflow Chart */}
        <div className="bg-white border border-black/5 p-5 rounded-2xl shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-black flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#ffa200]" /> Cashflow Overview
          </h3>
          <div className="w-full bg-bg-light rounded-full h-3 overflow-hidden flex">
            {revenueTotal === 0 && totalOutflow === 0 ? (
              <div className="bg-gray-200 h-full w-full"></div>
            ) : (
              <>
                <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: \`\${(revenueTotal / (revenueTotal + totalOutflow)) * 100}%\` }}></div>
                <div className="bg-rose-400 h-full transition-all duration-500" style={{ width: \`\${(totalOutflow / (revenueTotal + totalOutflow)) * 100}%\` }}></div>
              </>
            )}
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-emerald-500">Inflow: ₵{revenueTotal.toFixed(2)}</span>
            <span className="text-rose-500">Outflow: ₵{totalOutflow.toFixed(2)}</span>
          </div>
        </div>
`;
content = content.replace('        {/* Tab switcher */}', chartHtml + '\n        {/* Tab switcher */}');

// Add CSV export button
const csvBtnStr = `
              <button
                onClick={downloadLedgerReport}
                className="flex items-center gap-2 px-4 py-2 bg-[#ffa200] hover:bg-[#ffa200]/80 text-black font-bold rounded-xl transition-all duration-300 text-xs shadow-sm border border-transparent"
              >
                <Download className="w-3.5 h-3.5 text-black" />
                Export Ledger (CSV)
              </button>
            </div>
`;
content = content.replace(`                </select>
              </div>
            </div>`, csvBtnStr);

fs.writeFileSync(file, content);
console.log('Update script finished.');
