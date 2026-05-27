(() => {
  'use strict';

  window.HGG_REVIEWER_APP_LOADED = true;

  const TOOL_HINTS = {
    select: '목록에서 주석을 선택해 이름, 근거 ID, 설명을 수정할 수 있습니다.',
    zone: '구역: 두 지점을 클릭해 지지/저항 또는 수요/공급 구간을 표시합니다.',
    line: '선: 두 지점을 클릭해 추세선, 채널 경계, 일반 경계선을 표시합니다.',
    pattern_boundary: '패턴: 두 지점을 클릭해 neckline, wedge boundary, defended high/low 같은 패턴 경계를 표시합니다.',
    fib: '피보: 기준 시작점과 끝점을 클릭해 retracement/extension 레벨을 표시합니다.',
    note: '메모: 한 지점을 클릭해 차트에 짧은 메모를 고정합니다.',
    entry: '진입: 한 지점을 클릭해 L/S 진입 후보 가격선을 표시합니다.',
    stop: '손절: 한 지점을 클릭해 손절 또는 무효화 가격선을 표시합니다.',
    tp1: 'TP1: 한 지점을 클릭해 첫 번째 익절 검토 가격선을 표시합니다.'
  };

  const FIB_LEVELS = [0, 0.382, 0.5, 0.618, 0.786, 0.886, 1, 1.13, 1.27, 1.414];
  const ONE_CLICK_TYPES = ['note', 'entry', 'stop', 'tp1'];
  const TWO_CLICK_TYPES = ['zone', 'line', 'pattern_boundary', 'fib'];

  const state = {
    tool: 'select',
    pending: null,
    annotations: [],
    selectedId: null,
    activeTimeframe: null
  };

  const el = {
    meta: document.getElementById('metaLine'),
    chartWrap: document.getElementById('chartWrap'),
    chart: document.getElementById('chart'),
    layer: document.getElementById('annotationLayer'),
    toolHint: document.getElementById('toolHint'),
    label: document.getElementById('labelInput'),
    evidence: document.getElementById('evidenceInput'),
    comment: document.getElementById('commentInput'),
    reviewer: document.getElementById('reviewerInput'),
    overallRating: document.getElementById('overallRating'),
    evidenceRating: document.getElementById('evidenceRating'),
    levelRating: document.getElementById('levelRating'),
    visualRating: document.getElementById('visualRating'),
    reviewNote: document.getElementById('reviewNoteInput'),
    list: document.getElementById('annotationList'),
    dataFile: document.getElementById('dataFile'),
    exportBtn: document.getElementById('exportBtn'),
    copyBtn: document.getElementById('copyBtn'),
    markdownExportBtn: document.getElementById('markdownExportBtn'),
    markdownCopyBtn: document.getElementById('markdownCopyBtn'),
    importFile: document.getElementById('importFile'),
    undoBtn: document.getElementById('undoBtn'),
    clearBtn: document.getElementById('clearBtn'),
    applyEditBtn: document.getElementById('applyEditBtn'),
    clearSelectionBtn: document.getElementById('clearSelectionBtn'),
    deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
    readout: document.getElementById('valueReadout'),
    timeframeSelect: document.getElementById('timeframeSelect')
  };

  let dataBundle = normalizeDataBundle(window.HGG_REVIEWER_DATA || buildSampleData());
  let data = dataBundle.views[dataBundle.activeTimeframe];
  state.activeTimeframe = dataBundle.activeTimeframe;
  populateTimeframeSelect();
  state.annotations = loadInitialAnnotations();
  updateMeta();

  const priceChart = LightweightCharts.createChart(el.chart, {
    layout: { background: { color: '#10141b' }, textColor: '#d7dee9' },
    grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
    rightPriceScale: { borderColor: '#334155' },
    timeScale: { borderColor: '#334155', timeVisible: true },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    attributionLogo: true
  });

  const candleSeries = priceChart.addCandlestickSeries({
    upColor: '#00b386',
    downColor: '#ef4444',
    borderUpColor: '#00b386',
    borderDownColor: '#ef4444',
    wickUpColor: '#00b386',
    wickDownColor: '#ef4444'
  });

  priceChart.priceScale('right').applyOptions({
    scaleMargins: { top: 0.05, bottom: 0.25 }
  });

  const volumeSeries = priceChart.addHistogramSeries({
    priceScaleId: 'volume',
    priceFormat: { type: 'volume' }
  });
  priceChart.priceScale('volume').applyOptions({
    scaleMargins: { top: 0.78, bottom: 0 }
  });

  const maSeries = {
    ma5: priceChart.addLineSeries({ color: '#ffffff', lineWidth: 1, priceLineVisible: false }),
    ma20: priceChart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceLineVisible: false }),
    ma60: priceChart.addLineSeries({ color: '#facc15', lineWidth: 1, priceLineVisible: false }),
    ma120: priceChart.addLineSeries({ color: '#22c55e', lineWidth: 1, priceLineVisible: false }),
    ma200: priceChart.addLineSeries({ color: '#8b5cf6', lineWidth: 1, priceLineVisible: false }),
    ma240: priceChart.addLineSeries({ color: '#2563eb', lineWidth: 1, priceLineVisible: false })
  };

  const miniCharts = [];
  const rsiChart = makeMiniChart('rsiChart');
  const rsiSeries = rsiChart.addLineSeries({
    color: '#60a5fa',
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false
  });
  addOscillatorGuides(rsiSeries, [30, 50, 70]);

  const stoShortChart = makeMiniChart('stoShortChart');
  const stoMiddleChart = makeMiniChart('stoMiddleChart');
  const stoLongChart = makeMiniChart('stoLongChart');
  const stoSeries = {
    shortK: stoShortChart.addLineSeries({ color: '#2563eb', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }),
    shortD: stoShortChart.addLineSeries({ color: '#ef4444', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }),
    middleK: stoMiddleChart.addLineSeries({ color: '#2563eb', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }),
    middleD: stoMiddleChart.addLineSeries({ color: '#ef4444', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }),
    longK: stoLongChart.addLineSeries({ color: '#2563eb', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }),
    longD: stoLongChart.addLineSeries({ color: '#ef4444', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
  };
  [stoSeries.shortK, stoSeries.middleK, stoSeries.longK].forEach(series => {
    addOscillatorGuides(series, [20, 50, 80]);
  });

  setAllSeriesData();
  syncTimeScales([priceChart, rsiChart, stoShortChart, stoMiddleChart, stoLongChart]);
  setupCrosshairReadout([priceChart, rsiChart, stoShortChart, stoMiddleChart, stoLongChart]);
  setupEvents();
  resizeAll();
  renderAll();

  function makeMiniChart(id) {
    const container = document.getElementById(id);
    const chart = LightweightCharts.createChart(container, {
      layout: { background: { color: '#10141b' }, textColor: '#cbd5e1' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      rightPriceScale: { borderColor: '#334155', visible: false },
      timeScale: { borderColor: '#334155', timeVisible: true },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      attributionLogo: false
    });
    miniCharts.push({ chart, container });
    return chart;
  }

  function setAllSeriesData() {
    candleSeries.setData(data.candles);
    volumeSeries.setData(data.volume);
    Object.entries(maSeries).forEach(([key, series]) => {
      series.setData(data.movingAverages[key]);
    });
    rsiSeries.setData(data.rsi);
    stoSeries.shortK.setData(data.stochastic.short.k);
    stoSeries.shortD.setData(data.stochastic.short.d);
    stoSeries.middleK.setData(data.stochastic.middle.k);
    stoSeries.middleD.setData(data.stochastic.middle.d);
    stoSeries.longK.setData(data.stochastic.long.k);
    stoSeries.longD.setData(data.stochastic.long.d);
    updateReadout(data.candles[data.candles.length - 1]);
  }

  function populateTimeframeSelect() {
    if (!el.timeframeSelect) return;
    el.timeframeSelect.innerHTML = '';
    dataBundle.order.forEach(timeframe => {
      const option = document.createElement('option');
      option.value = timeframe;
      option.textContent = timeframeLabel(timeframe);
      el.timeframeSelect.append(option);
    });
    el.timeframeSelect.value = dataBundle.activeTimeframe;
    el.timeframeSelect.disabled = dataBundle.order.length <= 1;
  }

  function switchTimeframe(timeframe) {
    if (!dataBundle.views[timeframe] || timeframe === dataBundle.activeTimeframe) return;
    saveLocal();
    dataBundle.activeTimeframe = timeframe;
    state.activeTimeframe = timeframe;
    data = dataBundle.views[timeframe];
    state.pending = null;
    state.annotations = loadInitialAnnotations();
    setSelected(null);
    setAllSeriesData();
    updateMeta();
    fitAllContent();
    renderAll();
  }

  function fitAllContent() {
    priceChart.timeScale().fitContent();
    [rsiChart, stoShortChart, stoMiddleChart, stoLongChart].forEach(chart => chart.timeScale().fitContent());
  }

  function addOscillatorGuides(series, values) {
    values.forEach(value => {
      series.createPriceLine({
        price: value,
        color: value === 50 ? 'rgba(148,163,184,0.7)' : 'rgba(148,163,184,0.45)',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dotted,
        axisLabelVisible: false,
        title: ''
      });
    });
  }

  function setupCrosshairReadout(charts) {
    charts.forEach(chart => {
      chart.subscribeCrosshairMove(param => {
        if (!param || param.time == null) return;
        updateReadout(data.candle_lookup[timeKey(param.time)]);
      });
    });
  }

  function updateReadout(candle) {
    if (!candle || !el.readout) return;
    el.readout.innerHTML = [
      `<span><strong>${escapeHtml(formatTime(candle.time))}</strong></span>`,
      `<span>O ${fmt(candle.open)}</span>`,
      `<span>H ${fmt(candle.high)}</span>`,
      `<span>L ${fmt(candle.low)}</span>`,
      `<span>C ${fmt(candle.close)}</span>`,
      `<span>Vol ${fmtVolume(candle.volume)}</span>`,
      `<span>RSI ${fmt(candle.rsi)}</span>`,
      `<span>StoS ${fmt(candle.stoShortK)}/${fmt(candle.stoShortD)}</span>`,
      `<span>StoM ${fmt(candle.stoMiddleK)}/${fmt(candle.stoMiddleD)}</span>`,
      `<span>StoL ${fmt(candle.stoLongK)}/${fmt(candle.stoLongD)}</span>`,
      `<span>MA5/20/60/120/200/240 ${fmt(candle.ma5)}/${fmt(candle.ma20)}/${fmt(candle.ma60)}/${fmt(candle.ma120)}/${fmt(candle.ma200)}/${fmt(candle.ma240)}</span>`
    ].join('');
  }

  function setupEvents() {
    document.querySelectorAll('.tool').forEach(button => {
      button.addEventListener('click', () => setTool(button.dataset.tool));
    });

    el.chartWrap.addEventListener('click', event => {
      const point = eventToChartPoint(event);
      if (!point || state.tool === 'select') return;
      handleToolPoint(point);
    });

    el.undoBtn.addEventListener('click', () => {
      state.annotations.pop();
      state.pending = null;
      setSelected(null);
      saveLocal();
      renderAll();
    });

    el.clearBtn.addEventListener('click', () => {
      if (!confirm('모든 주석을 지울까요?')) return;
      state.annotations = [];
      state.pending = null;
      setSelected(null);
      saveLocal();
      renderAll();
    });

    el.exportBtn.addEventListener('click', downloadExport);
    el.copyBtn.addEventListener('click', copyExport);
    el.markdownExportBtn.addEventListener('click', downloadMarkdown);
    el.markdownCopyBtn.addEventListener('click', copyMarkdown);
    el.dataFile.addEventListener('change', loadDataFile);
    el.importFile.addEventListener('change', importAnnotations);
    el.applyEditBtn.addEventListener('click', applySelectedEdit);
    el.clearSelectionBtn.addEventListener('click', () => setSelected(null));
    el.deleteSelectedBtn.addEventListener('click', deleteSelected);
    if (el.timeframeSelect) {
      el.timeframeSelect.addEventListener('change', event => switchTimeframe(event.target.value));
    }
    el.list.addEventListener('click', handleListClick);
    window.addEventListener('resize', resizeAll);
    priceChart.timeScale().subscribeVisibleTimeRangeChange(renderAnnotations);
  }

  function setTool(tool) {
    state.tool = tool;
    state.pending = null;
    document.querySelectorAll('.tool').forEach(button => {
      button.classList.toggle('active', button.dataset.tool === tool);
    });
    el.toolHint.textContent = TOOL_HINTS[tool] || '';
  }

  function eventToChartPoint(event) {
    const rect = el.chart.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const time = priceChart.timeScale().coordinateToTime(x);
    const price = candleSeries.coordinateToPrice(y);
    if (time == null || price == null || !Number.isFinite(price)) return null;
    const source = data.time_lookup[timeKey(time)] || {};
    return {
      time,
      hidden_time: source.hidden_time,
      bar_index: source.bar_index,
      price: round(price),
      x,
      y
    };
  }

  function handleToolPoint(point) {
    if (ONE_CLICK_TYPES.includes(state.tool)) {
      addAnnotation({ type: state.tool, points: [point] });
      return;
    }
    if (!TWO_CLICK_TYPES.includes(state.tool)) return;
    if (!state.pending) {
      state.pending = point;
      el.toolHint.textContent = '첫 번째 지점을 저장했습니다. 두 번째 지점을 클릭하세요.';
      return;
    }
    addAnnotation({ type: state.tool, points: [state.pending, point] });
    state.pending = null;
    el.toolHint.textContent = TOOL_HINTS[state.tool];
  }

  function addAnnotation(base) {
    const type = normalizeAnnotationType(base.type);
    const annotation = {
      id: nextAnnotationId(),
      type,
      label: el.label.value.trim() || defaultLabel(type),
      related_evidence_id: el.evidence.value.trim(),
      comment: el.comment.value.trim(),
      points: base.points.map(p => ({
        time: p.time,
        hidden_time: p.hidden_time,
        bar_index: p.bar_index,
        price: p.price
      }))
    };
    state.annotations.push(annotation);
    clearAnnotationInputs();
    setSelected(annotation.id);
    saveLocal();
    renderAll();
  }

  function nextAnnotationId() {
    const max = state.annotations.reduce((highest, annotation) => {
      const match = String(annotation.id || '').match(/^A(\d+)$/i);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    return `A${String(max + 1).padStart(3, '0')}`;
  }

  function renderAll() {
    renderAnnotations();
    renderList();
    refreshSelectedControls();
  }

  function renderAnnotations() {
    el.layer.setAttribute('width', el.chart.clientWidth);
    el.layer.setAttribute('height', el.chart.clientHeight);
    el.layer.innerHTML = '';
    state.annotations.forEach(drawAnnotation);
  }

  function drawAnnotation(annotation) {
    if (annotation.type === 'zone') return drawZone(annotation);
    if (annotation.type === 'line') return drawLine(annotation, 'annotation-line');
    if (annotation.type === 'pattern_boundary') return drawLine(annotation, 'annotation-pattern-boundary');
    if (annotation.type === 'fib') return drawFib(annotation);
    if (['entry', 'stop', 'tp1'].includes(annotation.type)) return drawLevel(annotation);
    if (annotation.type === 'note') return drawNote(annotation);
    return null;
  }

  function pointToCoord(point) {
    const x = priceChart.timeScale().timeToCoordinate(point.time);
    const y = candleSeries.priceToCoordinate(point.price);
    if (x == null || y == null) return null;
    return { x, y };
  }

  function drawZone(annotation) {
    const a = pointToCoord(annotation.points[0]);
    const b = pointToCoord(annotation.points[1]);
    if (!a || !b) return;
    const rect = svg('rect', {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
      class: 'annotation-zone'
    });
    el.layer.append(rect);
    drawText(annotationTitle(annotation), Math.min(a.x, b.x) + 4, Math.min(a.y, b.y) + 14);
  }

  function drawLine(annotation, className) {
    const a = pointToCoord(annotation.points[0]);
    const b = pointToCoord(annotation.points[1]);
    if (!a || !b) return;
    el.layer.append(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: className }));
    drawText(annotationTitle(annotation), b.x + 4, b.y - 4);
  }

  function drawFib(annotation) {
    const p0 = annotation.points[0];
    const p1 = annotation.points[1];
    const a = pointToCoord(p0);
    const b = pointToCoord(p1);
    if (!a || !b) return;
    const x1 = Math.min(a.x, b.x);
    const x2 = Math.max(a.x, b.x);
    FIB_LEVELS.forEach(level => {
      const price = p0.price + (p1.price - p0.price) * level;
      const y = candleSeries.priceToCoordinate(price);
      if (y == null) return;
      el.layer.append(svg('line', { x1, y1: y, x2, y2: y, class: 'annotation-fib' }));
      drawText(`${evidenceOrId(annotation)} ${formatFibLevel(level)}`, x2 + 4, y - 4);
    });
  }

  function drawLevel(annotation) {
    const point = annotation.points[0];
    const coord = pointToCoord(point);
    if (!coord) return;
    const className = `annotation-${annotation.type}`;
    el.layer.append(svg('line', { x1: 0, y1: coord.y, x2: el.chart.clientWidth, y2: coord.y, class: className }));
    drawText(`${annotationTitle(annotation)} ${fmt(point.price)}`, 8, coord.y - 5);
  }

  function drawNote(annotation) {
    const coord = pointToCoord(annotation.points[0]);
    if (!coord) return;
    el.layer.append(svg('circle', { cx: coord.x, cy: coord.y, r: 4, class: 'annotation-note-dot' }));
    drawText(annotationTitle(annotation), coord.x + 7, coord.y - 7);
  }

  function annotationTitle(annotation) {
    const evidence = annotation.related_evidence_id ? `[${annotation.related_evidence_id}]` : '';
    return `${annotation.id || ''} ${evidence} ${annotation.label || ''}`.trim();
  }

  function evidenceOrId(annotation) {
    return annotation.related_evidence_id || annotation.id || '';
  }

  function drawText(text, x, y) {
    const label = svg('text', {
      x: clamp(x, 4, Math.max(4, el.chart.clientWidth - 80)),
      y: clamp(y, 14, Math.max(14, el.chart.clientHeight - 6)),
      class: 'annotation-text'
    });
    label.textContent = text || '';
    el.layer.append(label);
  }

  function svg(name, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function renderList() {
    el.list.innerHTML = '';
    state.annotations.forEach(annotation => {
      const item = document.createElement('li');
      item.classList.toggle('selected', annotation.id === state.selectedId);
      item.dataset.id = annotation.id;
      item.innerHTML = [
        '<div class="row">',
        `<strong>${escapeHtml(annotation.id)} ${escapeHtml(typeLabel(annotation.type))}</strong>`,
        '<span class="mini-actions">',
        `<button type="button" data-select-id="${escapeHtml(annotation.id)}">수정</button>`,
        `<button type="button" data-delete-id="${escapeHtml(annotation.id)}">삭제</button>`,
        '</span>',
        '</div>',
        `<div>${escapeHtml(annotation.label || '')}</div>`,
        annotation.related_evidence_id ? `<div>근거: ${escapeHtml(annotation.related_evidence_id)}</div>` : '',
        annotation.comment ? `<p>${escapeHtml(annotation.comment)}</p>` : ''
      ].join('');
      el.list.append(item);
    });
  }

  function handleListClick(event) {
    const target = event.target || {};
    const dataset = target.dataset || {};
    const selectId = dataset.selectId;
    const deleteId = dataset.deleteId;
    if (selectId) {
      setSelected(selectId);
      renderAll();
      return;
    }
    if (deleteId) {
      deleteAnnotation(deleteId);
      return;
    }
    const item = event.target.closest('li[data-id]');
    if (item) {
      setSelected(item.dataset.id);
      renderAll();
    }
  }

  function setSelected(id) {
    state.selectedId = id;
    const annotation = selectedAnnotation();
    if (annotation) {
      el.label.value = annotation.label || '';
      el.evidence.value = annotation.related_evidence_id || '';
      el.comment.value = annotation.comment || '';
    } else {
      clearAnnotationInputs();
    }
    refreshSelectedControls();
  }

  function selectedAnnotation() {
    return state.annotations.find(annotation => annotation.id === state.selectedId) || null;
  }

  function refreshSelectedControls() {
    const hasSelection = Boolean(selectedAnnotation());
    el.applyEditBtn.disabled = !hasSelection;
    el.clearSelectionBtn.disabled = !hasSelection;
    el.deleteSelectedBtn.disabled = !hasSelection;
  }

  function applySelectedEdit() {
    const annotation = selectedAnnotation();
    if (!annotation) return;
    annotation.label = el.label.value.trim() || defaultLabel(annotation.type);
    annotation.related_evidence_id = el.evidence.value.trim();
    annotation.comment = el.comment.value.trim();
    saveLocal();
    renderAll();
    el.toolHint.textContent = `${annotation.id} 주석을 수정했습니다.`;
  }

  function deleteSelected() {
    if (!state.selectedId) return;
    deleteAnnotation(state.selectedId);
  }

  function deleteAnnotation(id) {
    state.annotations = state.annotations.filter(annotation => annotation.id !== id);
    if (state.selectedId === id) setSelected(null);
    saveLocal();
    renderAll();
    el.toolHint.textContent = `${id} 주석을 삭제했습니다.`;
  }

  function clearAnnotationInputs() {
    el.label.value = '';
    el.evidence.value = '';
    el.comment.value = '';
  }

  function currentReview() {
    return {
      reviewer: el.reviewer.value.trim(),
      ratings: {
        overall_perspective: el.overallRating.value,
        evidence_combination: el.evidenceRating.value,
        level_logic: el.levelRating.value,
        visual_overlay_clarity: el.visualRating.value
      },
      notes: el.reviewNote.value.trim()
    };
  }

  function exportPayload() {
    return {
      feedback_version: 'chart_reviewer_v2',
      perspective_id: data.perspective_id,
      symbol: data.symbol,
      timeframe: data.timeframe,
      available_timeframes: dataBundle.order,
      exported_at: new Date().toISOString(),
      data_window: {
        first_time: data.candles[0] ? data.candles[0].time : null,
        last_time: data.candles[data.candles.length - 1] ? data.candles[data.candles.length - 1].time : null
      },
      review: currentReview(),
      annotations: state.annotations
    };
  }

  function downloadExport() {
    downloadText(JSON.stringify(exportPayload(), null, 2), `${safeFilePart(data.perspective_id)}_${safeFilePart(data.timeframe)}_feedback.json`, 'application/json');
  }

  async function copyExport() {
    await navigator.clipboard.writeText(JSON.stringify(exportPayload(), null, 2));
    el.toolHint.textContent = '피드백 JSON을 복사했습니다.';
  }

  function downloadMarkdown() {
    downloadText(feedbackMarkdown(), `${safeFilePart(data.perspective_id)}_${safeFilePart(data.timeframe)}_feedback.md`, 'text/markdown');
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(feedbackMarkdown());
    el.toolHint.textContent = '피드백 Markdown을 복사했습니다.';
  }

  function feedbackMarkdown() {
    const payload = exportPayload();
    const review = payload.review;
    const lines = [
      '# Chart Perspective Feedback',
      '',
      '## Metadata',
      '',
      `- Perspective ID: ${payload.perspective_id}`,
      `- Symbol: ${payload.symbol}`,
      `- Timeframe: ${payload.timeframe}`,
      `- Exported at: ${payload.exported_at}`,
      `- Reviewer: ${review.reviewer || ''}`,
      `- Annotation count: ${payload.annotations.length}`,
      '',
      '## Ratings',
      '',
      '| Review area | Rating |',
      '|---|---|',
      `| Overall perspective | ${markdownCell(review.ratings.overall_perspective)} |`,
      `| Evidence combination | ${markdownCell(review.ratings.evidence_combination)} |`,
      `| Level logic | ${markdownCell(review.ratings.level_logic)} |`,
      `| Visual overlay clarity | ${markdownCell(review.ratings.visual_overlay_clarity)} |`,
      '',
      '## Review Notes',
      '',
      review.notes || '',
      '',
      '## Chart Annotations',
      ''
    ];

    if (!payload.annotations.length) {
      lines.push('- No annotations.');
    } else {
      payload.annotations.forEach(annotation => {
        lines.push(`### ${annotation.id} ${typeLabel(annotation.type)}`);
        lines.push('');
        lines.push(`- Label: ${annotation.label || ''}`);
        lines.push(`- Related evidence ID: ${annotation.related_evidence_id || ''}`);
        lines.push(`- Comment: ${annotation.comment || ''}`);
        lines.push('- Points:');
        annotation.points.forEach((point, idx) => {
          lines.push(`  - P${idx + 1}: time=${formatTime(point.time)}, price=${fmt(point.price)}, hidden_time=${point.hidden_time || ''}, bar_index=${firstDefined(point.bar_index, '')}`);
        });
        lines.push('');
      });
    }

    lines.push('## WAL 검토 슬롯');
    lines.push('');
    lines.push('- 현재 차트 상황:');
    lines.push('- 판단 지점:');
    lines.push('- 사용한 근거:');
    lines.push('- 롱 근거:');
    lines.push('- 숏 근거:');
    lines.push('- 약한/누락/충돌 근거:');
    lines.push('- 다음 판단으로 가져갈 결론:');
    lines.push('');
    return lines.join('\n');
  }

  function downloadText(content, fileName, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importAnnotations(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        state.annotations = normalizeAnnotations(parsed);
        setSelected(null);
        saveLocal();
        renderAll();
        el.toolHint.textContent = `${file.name} 주석을 가져왔습니다.`;
      } catch (error) {
        el.toolHint.textContent = `주석 가져오기 실패: ${error.message}`;
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  function loadDataFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const loaded = file.name.toLowerCase().endsWith('.csv')
          ? parseCsvData(text, file.name)
          : JSON.parse(text);
        dataBundle = normalizeDataBundle(loaded);
        data = dataBundle.views[dataBundle.activeTimeframe];
        state.activeTimeframe = dataBundle.activeTimeframe;
        populateTimeframeSelect();
        state.annotations = loadInitialAnnotations();
        setSelected(null);
        setAllSeriesData();
        updateMeta();
        fitAllContent();
        renderAll();
        el.toolHint.textContent = `${file.name} 파일을 불러왔습니다.`;
      } catch (error) {
        el.toolHint.textContent = `데이터 불러오기 실패: ${error.message}`;
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  function saveLocal() {
    localStorage.setItem(localKey(), JSON.stringify(state.annotations));
  }

  function loadInitialAnnotations() {
    const stored = loadLocal();
    return Array.isArray(stored) ? stored : cloneAnnotations(data.annotations);
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(localKey());
      return raw == null ? null : JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function localKey() {
    return `hgg-chart-reviewer:${data.perspective_id}:${data.timeframe}`;
  }

  function resizeAll() {
    const mainRect = el.chartWrap.getBoundingClientRect();
    priceChart.applyOptions({ width: Math.floor(mainRect.width), height: Math.floor(mainRect.height) });
    miniCharts.forEach(({ chart, container }) => {
      chart.applyOptions({ width: Math.floor(container.clientWidth), height: Math.floor(container.clientHeight) });
    });
    renderAnnotations();
  }

  function syncTimeScales(charts) {
    charts.forEach(source => {
      source.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (!range) return;
        charts.forEach(target => {
          if (target !== source) target.timeScale().setVisibleLogicalRange(range);
        });
      });
    });
  }

  function normalizeDataBundle(input) {
    const fallback = buildSampleData();
    const source = input && typeof input === 'object' ? input : fallback;
    const rawViews = source.timeframes || source.views;
    const views = {};
    let order = [];

    if (rawViews && typeof rawViews === 'object' && !Array.isArray(rawViews)) {
      const keys = Object.keys(rawViews).filter(key => rawViews[key] && typeof rawViews[key] === 'object');
      const preferred = ['4h', '1d', '1w'];
      order = preferred.filter(key => keys.includes(key)).concat(keys.filter(key => !preferred.includes(key)));
      order.forEach(timeframe => {
        const viewSource = rawViews[timeframe] || {};
        const annotationsByTimeframe = source.annotations_by_timeframe && source.annotations_by_timeframe[timeframe];
        views[timeframe] = normalizeData({
          ...source,
          ...viewSource,
          timeframes: undefined,
          views: undefined,
          timeframe: viewSource.timeframe || timeframe,
          symbol: viewSource.symbol || source.symbol,
          perspective_id: source.perspective_id || viewSource.perspective_id,
          annotations: firstDefined(viewSource.annotations, annotationsByTimeframe, timeframe === source.timeframe ? source.annotations : [])
        });
      });
    } else {
      const single = normalizeData(source);
      order = [single.timeframe];
      views[single.timeframe] = single;
    }

    if (!order.length) {
      const single = normalizeData(fallback);
      order = [single.timeframe];
      views[single.timeframe] = single;
    }

    const requested = source.active_timeframe || source.default_timeframe || source.timeframe;
    const activeTimeframe = order.includes(requested)
      ? requested
      : order.includes('1d')
        ? '1d'
        : order[0];

    return { views, order, activeTimeframe };
  }

  function normalizeData(input) {
    const fallback = buildSampleData();
    const source = input && typeof input === 'object' ? input : fallback;
    const sourceCandles = Array.isArray(source.candles) && source.candles.length ? source.candles : fallback.candles;
    const timeLookup = {};
    const candleLookup = {};
    const candles = sourceCandles.map((c, idx) => {
      const time = c.time || c.chart_time || syntheticDate(idx);
      const stoShortK = parseNumber(firstDefined(c.stoShortK, c.stoShort, c.STO_SHORT_K), 50);
      const stoMiddleK = parseNumber(firstDefined(c.stoMiddleK, c.stoMiddle, c.STO_MIDDLE_K), 50);
      const stoLongK = parseNumber(firstDefined(c.stoLongK, c.stoLong, c.STO_LONG_K), 50);
      const candle = {
        time,
        open: parseNumber(c.open),
        high: parseNumber(c.high),
        low: parseNumber(c.low),
        close: parseNumber(c.close),
        volume: parseNumber(c.volume, 0),
        rsi: parseNumber(firstDefined(c.rsi, c.RSI_14), 50),
        stoShortK,
        stoShortD: parseNumber(firstDefined(c.stoShortD, c.STO_SHORT_D), stoShortK),
        stoMiddleK,
        stoMiddleD: parseNumber(firstDefined(c.stoMiddleD, c.STO_MIDDLE_D), stoMiddleK),
        stoLongK,
        stoLongD: parseNumber(firstDefined(c.stoLongD, c.STO_LONG_D), stoLongK),
        ma5: parseNumber(firstDefined(c.ma5, c.MA_5), null),
        ma20: parseNumber(firstDefined(c.ma20, c.MA_20), null),
        ma60: parseNumber(firstDefined(c.ma60, c.MA_60), null),
        ma120: parseNumber(firstDefined(c.ma120, c.MA_120), null),
        ma200: parseNumber(firstDefined(c.ma200, c.MA_200), null),
        ma240: parseNumber(firstDefined(c.ma240, c.MA_240), null)
      };
      const key = timeKey(time);
      timeLookup[key] = {
        hidden_time: c.hidden_time || c.hiddenTime || c.t || c.actual_time,
        bar_index: firstDefined(c.bar_index, c.index, idx)
      };
      candleLookup[key] = candle;
      return candle;
    }).filter(c => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close));

    const normalized = {
      perspective_id: source.perspective_id || source.run_id || 'sample_perspective',
      symbol: source.symbol || 'SAMPLE',
      timeframe: source.timeframe || '1d',
      summary: source.summary || {},
      evidence_table: Array.isArray(source.evidence_table) ? source.evidence_table : [],
      wal_report: source.wal_report || {},
      source_window: source.source_window || {},
      candles,
      time_lookup: timeLookup,
      candle_lookup: candleLookup,
      annotations: normalizeAnnotations(source),
      volume: candles.map(c => ({
        time: c.time,
        value: c.volume || 0,
        color: c.close >= c.open ? 'rgba(0,179,134,0.42)' : 'rgba(239,68,68,0.42)'
      })),
      movingAverages: {
        ma5: lineData(candles, 'ma5'),
        ma20: lineData(candles, 'ma20'),
        ma60: lineData(candles, 'ma60'),
        ma120: lineData(candles, 'ma120'),
        ma200: lineData(candles, 'ma200'),
        ma240: lineData(candles, 'ma240')
      },
      rsi: candles.map(c => ({ time: c.time, value: c.rsi })),
      stochastic: {
        short: {
          k: candles.map(c => ({ time: c.time, value: c.stoShortK })),
          d: candles.map(c => ({ time: c.time, value: c.stoShortD }))
        },
        middle: {
          k: candles.map(c => ({ time: c.time, value: c.stoMiddleK })),
          d: candles.map(c => ({ time: c.time, value: c.stoMiddleD }))
        },
        long: {
          k: candles.map(c => ({ time: c.time, value: c.stoLongK })),
          d: candles.map(c => ({ time: c.time, value: c.stoLongD }))
        }
      }
    };
    return normalized;
  }

  function normalizeAnnotations(input) {
    const source = Array.isArray(input)
      ? input
      : input && Array.isArray(input.annotations)
        ? input.annotations
        : input && Array.isArray(input.overlays)
          ? input.overlays
          : [];
    return source
      .map((annotation, idx) => normalizeAnnotation(annotation, idx))
      .filter(annotation => annotation.points.length > 0);
  }

  function normalizeAnnotation(annotation, idx) {
    const type = normalizeAnnotationType(annotation.type);
    const rawPoints = Array.isArray(annotation.points)
      ? annotation.points
      : pointsFromOverlay(annotation);
    return {
      id: annotation.id || `A${String(idx + 1).padStart(3, '0')}`,
      type,
      label: annotation.label || defaultLabel(type),
      related_evidence_id: annotation.related_evidence_id || annotation.evidence_id || '',
      comment: annotation.comment || annotation.description || annotation.reason || '',
      points: rawPoints
        .map((point, pointIdx) => normalizeAnnotationPoint(point, pointIdx))
        .filter(point => point.time != null && Number.isFinite(point.price))
    };
  }

  function normalizeAnnotationPoint(point, idx) {
    const time = firstDefined(point.time, point.x, syntheticDate(idx));
    return {
      time,
      hidden_time: point.hidden_time || point.hiddenTime || point.t,
      bar_index: firstDefined(point.bar_index, point.index),
      price: parseNumber(firstDefined(point.price, point.y))
    };
  }

  function pointsFromOverlay(annotation) {
    if (Number.isFinite(Number(annotation.price))) {
      return [{ time: annotation.time || syntheticDate(0), price: Number(annotation.price) }];
    }
    if (Number.isFinite(Number(annotation.price_start)) && Number.isFinite(Number(annotation.price_end))) {
      return [
        { time: annotation.time_start || annotation.time || syntheticDate(0), price: Number(annotation.price_start) },
        { time: annotation.time_end || annotation.time || syntheticDate(1), price: Number(annotation.price_end) }
      ];
    }
    if (Number.isFinite(Number(annotation.upper)) && Number.isFinite(Number(annotation.lower))) {
      return [
        { time: annotation.time_start || annotation.time || syntheticDate(0), price: Number(annotation.upper) },
        { time: annotation.time_end || annotation.time || syntheticDate(1), price: Number(annotation.lower) }
      ];
    }
    return [];
  }

  function normalizeAnnotationType(type) {
    const normalized = String(type || 'note').toLowerCase();
    if (['support_zone', 'resistance_zone', 'zone', 'box', 'supply_zone', 'demand_zone'].includes(normalized)) return 'zone';
    if (['trendline', 'channel_line', 'line', 'hline'].includes(normalized)) return 'line';
    if (['pattern_boundary', 'neckline', 'boundary', 'pattern'].includes(normalized)) return 'pattern_boundary';
    if (['fibonacci_anchor', 'fib', 'fibonacci', 'retracement', 'extension'].includes(normalized)) return 'fib';
    if (['entry', 'entry_correction'].includes(normalized)) return 'entry';
    if (['stop', 'stop_correction', 'invalidation', 'invalidation_correction'].includes(normalized)) return 'stop';
    if (['tp1', 'take_profit', 'take_profit_1', 'tp1_correction'].includes(normalized)) return 'tp1';
    return 'note';
  }

  function cloneAnnotations(annotations) {
    return JSON.parse(JSON.stringify(annotations || []));
  }

  function parseCsvData(text, fileName) {
    const rows = parseCsv(text);
    const candles = rows.map((row, idx) => {
      const chartTime = row.chart_time || row.visual_time || syntheticDate(idx);
      return {
        time: chartTime,
        hidden_time: row.hidden_time || row.t || row.time || row.actual_time,
        bar_index: Number(firstDefined(row.bar_index, row.index, idx)),
        open: parseNumber(firstDefined(row.open, row.Open, row.OPEN)),
        high: parseNumber(firstDefined(row.high, row.High, row.HIGH)),
        low: parseNumber(firstDefined(row.low, row.Low, row.LOW)),
        close: parseNumber(firstDefined(row.close, row.Close, row.CLOSE)),
        volume: parseNumber(firstDefined(row.volume, row.Volume, row.VOLUME), 0),
        rsi: parseNumber(firstDefined(row.RSI_14, row.rsi, row.rsi_14), 50),
        stoShortK: parseNumber(firstDefined(row.STO_SHORT_K, row.stoShortK, row.sto_short_k), 50),
        stoShortD: parseNumber(firstDefined(row.STO_SHORT_D, row.stoShortD, row.sto_short_d), parseNumber(row.STO_SHORT_K, 50)),
        stoMiddleK: parseNumber(firstDefined(row.STO_MIDDLE_K, row.stoMiddleK, row.sto_middle_k), 50),
        stoMiddleD: parseNumber(firstDefined(row.STO_MIDDLE_D, row.stoMiddleD, row.sto_middle_d), parseNumber(row.STO_MIDDLE_K, 50)),
        stoLongK: parseNumber(firstDefined(row.STO_LONG_K, row.stoLongK, row.sto_long_k), 50),
        stoLongD: parseNumber(firstDefined(row.STO_LONG_D, row.stoLongD, row.sto_long_d), parseNumber(row.STO_LONG_K, 50)),
        ma5: parseNumber(firstDefined(row.MA_5, row.ma5), null),
        ma20: parseNumber(firstDefined(row.MA_20, row.ma20), null),
        ma60: parseNumber(firstDefined(row.MA_60, row.ma60), null),
        ma120: parseNumber(firstDefined(row.MA_120, row.ma120), null),
        ma200: parseNumber(firstDefined(row.MA_200, row.ma200), null),
        ma240: parseNumber(firstDefined(row.MA_240, row.ma240), null)
      };
    }).filter(c => Number.isFinite(c.open) && Number.isFinite(c.close));

    return {
      perspective_id: fileName.replace(/\.[^.]+$/, ''),
      symbol: rows[0] && rows[0].symbol ? rows[0].symbol : 'LOADED_CSV',
      timeframe: rows[0] && rows[0].timeframe ? rows[0].timeframe : '1d',
      candles
    };
  }

  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const headers = splitCsvLine(lines.shift() || '').map(header => header.trim());
    return lines.map(line => {
      const values = splitCsvLine(line);
      return Object.fromEntries(headers.map((header, idx) => [header, firstDefined(values[idx], '')]));
    });
  }

  function splitCsvLine(line) {
    const values = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }

  function updateMeta() {
    const viewText = dataBundle.order.length > 1 ? ` | HGG_VIEW ${dataBundle.order.map(timeframeLabel).join('/')}` : '';
    el.meta.textContent = `${data.symbol} ${timeframeLabel(data.timeframe)} | ${data.perspective_id}${viewText}`;
  }

  function timeframeLabel(timeframe) {
    const labels = {
      '4h': '4시간봉',
      '1d': '일봉',
      '1w': '주봉'
    };
    return labels[timeframe] || timeframe;
  }

  function syntheticDate(index) {
    const date = new Date('2000-01-01T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  }

  function buildSampleData() {
    const candles = [];
    let close = 100;
    const start = new Date('2026-01-01T00:00:00Z');
    for (let i = 0; i < 90; i += 1) {
      const wave = Math.sin(i / 6) * 2.4 + Math.cos(i / 13) * 1.8;
      const drift = i < 42 ? i * 0.18 : 7.6 - (i - 42) * 0.08;
      const next = 100 + drift + wave;
      const open = close;
      close = next;
      const high = Math.max(open, close) + 1.1 + (i % 5) * 0.13;
      const low = Math.min(open, close) - 1.0 - (i % 7) * 0.11;
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + i);
      candles.push({
        time: day.toISOString().slice(0, 10),
        open: round(open),
        high: round(high),
        low: round(low),
        close: round(close),
        volume: Math.round(1200 + Math.abs(close - open) * 340 + (i % 9) * 55),
        rsi: clamp(50 + (close - open) * 8 + Math.sin(i / 5) * 16, 18, 82),
        stoShortK: clamp(50 + Math.sin(i / 3) * 42, 2, 98),
        stoShortD: clamp(50 + Math.sin((i - 1) / 3) * 38, 2, 98),
        stoMiddleK: clamp(50 + Math.sin(i / 6) * 38, 3, 97),
        stoMiddleD: clamp(50 + Math.sin((i - 2) / 6) * 34, 3, 97),
        stoLongK: clamp(50 + Math.sin(i / 11) * 32, 5, 95),
        stoLongD: clamp(50 + Math.sin((i - 3) / 11) * 29, 5, 95)
      });
    }
    applySampleMovingAverages(candles);
    return {
      perspective_id: 'sample_daily_review',
      symbol: 'BTCUSDT_SAMPLE',
      timeframe: '1d',
      candles,
      annotations: [
        {
          id: 'A001',
          type: 'zone',
          label: 'L 진입 후보 지지구역',
          related_evidence_id: 'SR1',
          comment: '구간은 목록 설명만이 아니라 차트 박스로 직접 표시됩니다.',
          points: [
            { time: '2026-03-06', price: 102.6 },
            { time: '2026-03-14', price: 103.4 }
          ]
        },
        {
          id: 'A002',
          type: 'stop',
          label: 'L 무효화',
          related_evidence_id: 'INV1',
          comment: '손절/무효화는 차트의 수평선으로 표시됩니다.',
          points: [{ time: '2026-03-14', price: 101.7 }]
        },
        {
          id: 'A003',
          type: 'pattern_boundary',
          label: '패턴 경계 예시',
          related_evidence_id: 'PAT1',
          comment: '패턴은 이름만 붙이지 말고 경계/neckline/무효화 근거를 같이 그립니다.',
          points: [
            { time: '2026-03-05', price: 108.7 },
            { time: '2026-03-26', price: 107.6 }
          ]
        }
      ]
    };
  }

  function applySampleMovingAverages(candles) {
    [
      ['ma5', 5],
      ['ma20', 20],
      ['ma60', 60],
      ['ma120', 120],
      ['ma200', 200],
      ['ma240', 240]
    ].forEach(([key, length]) => {
      candles.forEach((candle, idx) => {
        if (idx + 1 < length) {
          candle[key] = null;
          return;
        }
        const slice = candles.slice(idx + 1 - length, idx + 1);
        candle[key] = round(slice.reduce((sum, item) => sum + item.close, 0) / length);
      });
    });
  }

  function lineData(candles, key) {
    return candles
      .filter(candle => Number.isFinite(candle[key]))
      .map(candle => ({ time: candle.time, value: candle[key] }));
  }

  function timeKey(time) {
    if (typeof time === 'string' || typeof time === 'number') return String(time);
    if (time && typeof time === 'object') {
      return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
    }
    return '';
  }

  function formatTime(time) {
    const key = timeKey(time);
    const source = data.time_lookup[key];
    return source && source.hidden_time ? `${key} (${source.hidden_time})` : key;
  }

  function fmt(value) {
    return Number.isFinite(value) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-';
  }

  function fmtVolume(value) {
    return Number.isFinite(value) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-';
  }

  function formatFibLevel(level) {
    return Number.isInteger(level) ? String(level) : String(level).replace(/^0/, '0');
  }

  function defaultLabel(type) {
    const labels = {
      zone: '구역',
      line: '선',
      pattern_boundary: '패턴 경계',
      fib: '피보',
      note: '메모',
      entry: '진입',
      stop: '손절/무효화',
      tp1: 'TP1'
    };
    return labels[type] || type;
  }

  function typeLabel(type) {
    return defaultLabel(type);
  }

  function firstDefined(...values) {
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] !== null && values[i] !== undefined) return values[i];
    }
    return undefined;
  }

  function parseNumber(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function clamp(value, min, max) {
    return Math.round(Math.max(min, Math.min(max, value)) * 100) / 100;
  }

  function safeFilePart(value) {
    return String(value || 'chart').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'chart';
  }

  function markdownCell(value) {
    return String(value || '').replace(/\|/g, '\\|');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char]));
  }
})();
