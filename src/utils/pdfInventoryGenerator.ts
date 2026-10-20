import { jsPDF } from 'jspdf';
import type { MoveRecord } from '../types.ts';
import {
  calculateClientBalance,
  calculateInventoryMetrics,
  formatCurrencyCOP,
  getPhotoRetentionStatus,
  PHOTO_RETENTION_DAYS,
} from './finance.ts';

const STATUS_LABELS: Record<MoveRecord['status'], string> = {
  programada: 'Programada',
  en_transito: 'En Tránsito',
  entregada: 'Entregada',
  liquidada: 'Liquidada',
};

export function generateClientInventoryPdfFilename(move: MoveRecord): string {
  const safeClient = (move.clientName || 'Cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const safeFolio = (move.folio || 'MUD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .toUpperCase();
  return `Inventario-${safeFolio}-${safeClient}.pdf`;
}

export function downloadClientInventoryPdf(move: MoveRecord): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  const bal = calculateClientBalance(move.totalContractAmount, move.amountPaid);
  const inv = calculateInventoryMetrics(move.inventory);

  const drawExecutiveHeader = (isContinuation = false) => {
    // Deep slate header band
    doc.setFillColor(15, 23, 42); // #0F172A
    doc.rect(0, 0, pageWidth, isContinuation ? 20 : 34, 'F');

    // Amber gold accent bar
    doc.setFillColor(245, 158, 11); // #F59E0B
    doc.rect(0, isContinuation ? 19 : 32.5, pageWidth, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isContinuation ? 11 : 15);
    doc.text(
      'ALDANA MUDANZAS CONTROL · MANIFIESTO OFICIAL DE INVENTARIO',
      margin,
      isContinuation ? 12 : 13
    );

    if (!isContinuation) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225);
      doc.text(
        'Certificación Logística de Carga, Evidencia Fotográfica HD y Estado de Cuenta (COP) · Colombia, Venezuela y Ecuador',
        margin,
        19.5
      );
      doc.text(
        `Política de Privacidad y Almacenamiento: Las fotografías de inventario se depuran automáticamente a los ${PHOTO_RETENTION_DAYS} días de su publicación.`,
        margin,
        25.5
      );
    }

    // Right folio pill
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isContinuation ? 9.5 : 11);
    doc.setTextColor(251, 191, 36);
    doc.text(
      `FOLIO: ${move.folio}`,
      pageWidth - margin,
      isContinuation ? 12 : 13,
      { align: 'right' }
    );

    if (!isContinuation) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(226, 232, 240);
      doc.text(
        `Fecha Mudanza: ${move.moveDate} · Estado: ${STATUS_LABELS[move.status]}`,
        pageWidth - margin,
        19.5,
        { align: 'right' }
      );
    }
  };

  drawExecutiveHeader(false);
  let y = 40;

  // Client & Route Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TITULAR DEL SERVICIO / CLIENTE', margin + 4, y + 5.5);
  doc.text('RUTA LOGÍSTICA Y UNIDAD ASIGNADA', margin + contentWidth / 2 + 2, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(move.clientName.slice(0, 48), margin + 4, y + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Teléfono: ${move.clientPhone}`, margin + 4, y + 17);
  doc.text(
    `Correo: ${move.clientEmail || 'No registrado'}`,
    margin + 4,
    y + 22.5
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${move.originCity}  ->  ${move.destinationCity}`,
    margin + contentWidth / 2 + 2,
    y + 11.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Distancia: ${move.distanceKm.toLocaleString('es-CO')} km · Unidad: ${move.truckUnit}`,
    margin + contentWidth / 2 + 2,
    y + 17
  );
  doc.text(
    `Indicaciones: ${(move.notes || 'Manejo estándar con protección acolchada').slice(0, 62)}`,
    margin + contentWidth / 2 + 2,
    y + 22.5
  );

  y += 33;

  // Financial & Cargo Summary Strip (4 boxes)
  const boxGap = 3;
  const boxW = (contentWidth - boxGap * 3) / 4;
  const boxes = [
    {
      title: 'FLETE COTIZADO (COP)',
      value: formatCurrencyCOP(bal.totalContract),
      sub: 'Contrato registrado',
      color: [15, 23, 42] as [number, number, number],
    },
    {
      title: 'ABONOS PAGADOS',
      value: formatCurrencyCOP(bal.amountPaid),
      sub: `${bal.paidPercentage}% cubierto`,
      color: [4, 120, 87] as [number, number, number],
    },
    {
      title: 'SALDO PENDIENTE',
      value: formatCurrencyCOP(bal.balanceDue),
      sub: bal.balanceDue > 0 ? 'Por liquidar en entrega' : 'Cuenta Liquidada',
      color: (bal.balanceDue > 0 ? [185, 28, 28] : [4, 120, 87]) as [number, number, number],
    },
    {
      title: 'RESUMEN DE CARGA',
      value: `${inv.totalUnits} pzas (${inv.totalVolumeM3} m³)`,
      sub: `${inv.totalWeightKg} kg · ${inv.itemsWithEvidenceCount} fotos HD`,
      color: [15, 23, 42] as [number, number, number],
    },
  ];

  boxes.forEach((b, idx) => {
    const bx = margin + idx * (boxW + boxGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(bx, y, boxW, 18, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(b.title, bx + 3, y + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(b.color[0], b.color[1], b.color[2]);
    doc.text(b.value, bx + 3, y + 10.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(b.sub, bx + 3, y + 15.5);
  });

  y += 23;

  // Inventory Section Header
  const drawTableHeader = (topY: number): number => {
    doc.setFillColor(30, 41, 59); // #1E293B
    doc.rect(margin, topY, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    doc.text('CANT.', margin + 2.5, topY + 5.3);
    doc.text('DESCRIPCIÓN DEL ARTÍCULO / MUEBLE', margin + 15, topY + 5.3);
    doc.text('CATEGORÍA', margin + 78, topY + 5.3);
    doc.text('VOL. / PESO', margin + 112, topY + 5.3);
    doc.text('EMBALAJE, ESTADO Y EVIDENCIA FOTOGRÁFICA', margin + 135, topY + 5.3);

    return topY + 8;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `DETALLE DE INVENTARIO CERTIFICADO (${inv.distinctLines} renglones · ${inv.totalUnits} piezas totales)`,
    margin,
    y
  );
  y += 3;
  y = drawTableHeader(y);

  if (move.inventory.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 14, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'No se han registrado artículos en el inventario de esta mudanza.',
      margin + 6,
      y + 8.5
    );
    y += 18;
  } else {
    move.inventory.forEach((item, index) => {
      const hasPhoto = Boolean(
        item.evidencePhotoDataUrl && item.evidencePhotoDataUrl.trim().length > 0
      );
      const hasDamage = Boolean(item.hasDamage || (item.damageNotes && item.damageNotes.trim()));
      const rowHeight = hasPhoto ? 24 : hasDamage ? 15 : 11;

      if (y + rowHeight > pageHeight - 38) {
        doc.addPage();
        drawExecutiveHeader(true);
        y = 26;
        y = drawTableHeader(y);
      }

      // Alternating row fill or soft red tint for damaged items
      if (hasDamage) {
        doc.setFillColor(254, 242, 242);
      } else if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, rowHeight, 'FD');

      // Quantity
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${item.quantity}x`, margin + 2.5, y + 6);

      // Item Name + Badges
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(15, 23, 42);
      const cleanName = item.name.slice(0, 36);
      doc.text(cleanName, margin + 15, y + 5.5);

      let subBadges = '';
      if (item.isFragile) subBadges += '[FRAGIL] ';
      if (hasDamage) subBadges += '[REPORTE MAL ESTADO] ';
      if (!subBadges) subBadges = 'Estado físico verificado OK';

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(hasDamage ? 185 : 100, hasDamage ? 28 : 116, hasDamage ? 28 : 139);
      doc.text(subBadges, margin + 15, y + 9.5);

      // Category
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(item.category, margin + 78, y + 6);

      // Volume / Weight
      const lineVol = (item.quantity * item.volumeM3).toFixed(2);
      const lineWeight = (item.quantity * item.weightKg).toFixed(0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${lineVol} m³`, margin + 112, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${lineWeight} kg`, margin + 112, y + 9.2);

      // Condition, Damage Notes & Embedded Compressed Photo
      const notesX = hasPhoto ? margin + 157 : margin + 135;
      const maxNotesLen = hasPhoto ? 24 : 40;

      if (hasPhoto && item.evidencePhotoDataUrl) {
        try {
          const format = item.evidencePhotoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(
            item.evidencePhotoDataUrl,
            format,
            margin + 135,
            y + 2,
            20,
            15,
            undefined,
            'FAST'
          );
          const retention = getPhotoRetentionStatus(
            item.evidencePhotoCreatedAt || item.updatedAt || item.createdAt
          );
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.8);
          doc.setTextColor(71, 85, 105);
          doc.text(
            `Vigencia foto: ${retention.daysRemaining}d`,
            margin + 135,
            y + 20.5
          );
        } catch {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6.5);
          doc.setTextColor(100, 116, 139);
          doc.text('[Foto HD Adjunta]', margin + 135, y + 8);
        }
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(51, 65, 85);
      const condText = (item.conditionNotes || 'Embalaje estándar').slice(0, maxNotesLen);
      doc.text(condText, notesX, y + 5.5);

      if (hasDamage) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(185, 28, 28);
        const dmgLine = `Daño: ${(item.damageNotes || 'Con evidencia fotográfica').slice(0, maxNotesLen - 4)}`;
        doc.text(dmgLine, notesX, y + 9.8);
      }

      y += rowHeight;
    });
  }

  // Ensure space for Signatures Footer
  if (y + 34 > pageHeight - 15) {
    doc.addPage();
    drawExecutiveHeader(true);
    y = 32;
  } else {
    y += 8;
  }

  // Signatures Block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'CONFORMIDAD DE INVENTARIO: El cliente y el operador certifican que los artículos y observaciones descritos corresponden al estado físico real de la carga.',
    margin + 4,
    y + 5.5
  );

  // Signature lines
  const sigY = y + 19;
  doc.setDrawColor(100, 116, 139);
  doc.line(margin + 14, sigY, margin + 82, sigY);
  doc.line(pageWidth - margin - 82, sigY, pageWidth - margin - 14, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `FIRMA DEL CLIENTE: ${move.clientName.slice(0, 28)}`,
    margin + 48,
    sigY + 4.5,
    { align: 'center' }
  );
  doc.text(
    'FIRMA SUPERVISOR ALDANA MUDANZAS',
    pageWidth - margin - 48,
    sigY + 4.5,
    { align: 'center' }
  );

  // Page numbers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Aldana Mudanzas Control · Manifiesto ${move.folio} · Moneda Oficial COP · Página ${p} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  const filename = generateClientInventoryPdfFilename(move);
  doc.save(filename);
  return filename;
}
