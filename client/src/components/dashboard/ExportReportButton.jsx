import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { endpoints } from "../../services/api";

export function ExportReportButton({ districtId }) {
  async function exportReport() {
    const { data } = await endpoints.exportReport({ districtId, format: "pdf" });
    const doc = new jsPDF();
    const date = new Date().toISOString().slice(0, 10);

    doc.setFontSize(18);
    doc.text("Smart Water Intelligence Report", 14, 18);
    doc.setFontSize(11);
    doc.text(`${data.county || "Makueni County"} · ${date}`, 14, 27);
    autoTable(doc, {
      startY: 36,
      head: [["Metric", "Value"]],
      body: [
        ["Water sources", `${data.summary.waterSources.total} total / ${data.summary.waterSources.active} active`],
        ["Sensors", `${data.summary.sensors.total} total / ${data.summary.sensors.online} online`],
        ["Active alerts", String(data.summary.alertsToday)]
      ]
    });

    doc.addPage();
    doc.text("Active Alerts", 14, 18);
    autoTable(doc, {
      startY: 26,
      head: [["Type", "Severity", "Sub-district", "Message"]],
      body: data.activeAlerts.map((alert) => [alert.alertType, alert.severity, alert.subDistrict || alert.district?.name || "", alert.message])
    });

    doc.addPage();
    doc.text("6-month Rainfall", 14, 18);
    autoTable(doc, {
      startY: 26,
      head: [["Month", "Rainfall (mm)", "Source"]],
      body: data.rainfall.map((row) => [row.month, row.mmTotal, row.source])
    });

    doc.addPage();
    doc.text("Latest Forecast", 14, 18);
    const forecast = data.latestForecast || {};
    autoTable(doc, {
      startY: 26,
      head: [["Risk score", "Risk label", "Forecast date"]],
      body: [[forecast.riskScore, forecast.riskLabel, forecast.forecastDate]]
    });
    const recommendations = forecast.recommendation || [];
    doc.text("Recommendations", 14, 70);
    recommendations.forEach((item, index) => doc.text(`- ${item}`, 18, 80 + index * 8));

    doc.save(`SmartWater_Report_${date}.pdf`);
  }

  return (
    <button onClick={exportReport} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-emerald-700 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
      <Download size={16} /> Export Report
    </button>
  );
}
