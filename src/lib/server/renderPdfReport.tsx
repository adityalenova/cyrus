import { join } from "node:path";
import { Document, Page, Text, View, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { reportText, type PdfReport } from "@/lib/reports";

Font.register({ family: "Cyrus", fonts: [
  { src: join(process.cwd(), "public/assets/fonts/PlusJakartaSans-400.ttf"), fontWeight: 400 },
  { src: join(process.cwd(), "public/assets/fonts/PlusJakartaSans-800.ttf"), fontWeight: 800 },
] });
Font.registerHyphenationCallback((word) => word.length > 32 ? word.match(/.{1,24}/gu) || [word] : [word]);

const styles = StyleSheet.create({
  page: { fontFamily: "Cyrus", fontSize: 9, paddingTop: 78, paddingHorizontal: 46, paddingBottom: 64, color: "#35251e", backgroundColor: "#fcfaf5" },
  header: { position: "absolute", top: 26, left: 46, right: 46, borderBottomWidth: 1, borderBottomColor: "#d9cbb6", paddingBottom: 10, flexDirection: "row", justifyContent: "space-between" },
  brand: { fontSize: 15, fontWeight: 800 },
  footer: { position: "absolute", bottom: 22, left: 46, right: 46, height: 28, fontSize: 7, color: "#6c5b4d" },
  title: { fontSize: 22, fontWeight: 800, marginBottom: 7 },
  sub: { fontSize: 10, color: "#875137", marginBottom: 17 },
  note: { marginBottom: 9 },
  fields: { marginTop: 12, marginBottom: 16 },
  field: { flexDirection: "row", borderBottomWidth: .5, borderBottomColor: "#e4dac9", paddingVertical: 6 },
  label: { width: 122, fontWeight: 800, paddingRight: 12 },
  value: { flex: 1 },
  chart: { marginTop: 12, padding: 14, borderWidth: .5, borderColor: "#d9cbb6", backgroundColor: "#fff" },
  chartTitle: { fontWeight: 800, fontSize: 10, marginBottom: 10 },
  barRow: { marginBottom: 9 },
  barLabel: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  track: { height: 7, backgroundColor: "#eee6d8" },
  bar: { height: 7, backgroundColor: "#a56a42" },
  entry: { paddingVertical: 5, borderBottomWidth: .5, borderBottomColor: "#e4dac9" },
  small: { fontSize: 7.5, color: "#6c5b4d" },
});

export async function renderPdfReport(input: PdfReport): Promise<Buffer> {
  await Font.load({ fontFamily: "Cyrus", fontWeight: 400, fontStyle: "normal" });
  const font = Font.getFont({ fontFamily: "Cyrus", fontWeight: 400, fontStyle: "normal" }).data;
  if (!font) throw new Error("Report font unavailable");
  let encodedGlyphs = false;
  // Preserve unsupported characters as explicit Unicode code points instead of blank boxes.
  const report = JSON.parse(JSON.stringify(input, (_key, value) => typeof value !== "string" ? value :
    [...reportText(value)].map((c) => {
      if (font.hasGlyphForCodePoint(c.codePointAt(0)!)) return c;
      encodedGlyphs = true;
      return `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]`;
    }).join(""))) as PdfReport;
  return renderToBuffer(<Document title={report.title} author="cyrus.ai" creator="cyrus.ai" language="en">
    {report.sections.map((section, index) => {
      const max = Math.max(1, ...section.chart?.rows.map((r) => r.value) || []);
      return <Page key={index} size={report.size} style={styles.page} wrap>
        <View fixed style={{ ...styles.header, fontFamily: "Cyrus" }}><Text style={styles.brand}>cyrus.ai</Text><Text>{report.title}</Text></View>
        <View style={{ fontFamily: "Cyrus" }}>
        <Text style={styles.title}>{section.title}</Text><Text style={styles.sub}>{section.subtitle}</Text>
        {section.notes.map((note, i) => <Text key={i} style={styles.note}>{note}</Text>)}
        {section.fields.length > 0 && <View style={styles.fields}>
          {section.fields.map(([label, value]) => <View key={label} style={styles.field} wrap={false}>
            <Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text>
          </View>)}
        </View>}
        {section.chart && <View style={styles.chart} wrap={false}>
          <Text style={styles.chartTitle}>{section.chart.title}</Text>
          {section.chart.rows.length === 0 && <Text>No events in this response.</Text>}
          {section.chart.rows.map((row, i) => <View key={i} style={styles.barRow}>
            <View style={styles.barLabel}><Text>{row.label}</Text><Text>{Number(row.value.toFixed(2)).toLocaleString("en-US")}</Text></View>
            <View style={styles.track}><View style={{ ...styles.bar, width: `${Math.max(0, row.value) / max * 100}%` }} /></View>
          </View>)}
        </View>}
        {section.entries?.map((entry, i) => <View key={i} style={styles.entry} wrap={false}>
          <Text>{entry.title}</Text><Text style={styles.small}>{entry.detail}</Text><Text style={styles.small}>{entry.url}</Text>
        </View>)}
        </View>
        <View fixed style={{ ...styles.footer, fontFamily: "Cyrus" }}>
          <Text>Generated {report.createdAt}. {encodedGlyphs ? "Unsupported font characters are represented as [U+CODE]." : "Source information is a snapshot."}</Text>
        </View>
        <Text fixed style={{ position: "absolute", bottom: 18, left: 46, right: 46, fontFamily: "Helvetica", fontSize: 7 }}
          render={({ pageNumber, totalPages }) => `cyrus.ai | ${pageNumber} / ${totalPages}`} />
      </Page>;
    })}
  </Document>);
}
