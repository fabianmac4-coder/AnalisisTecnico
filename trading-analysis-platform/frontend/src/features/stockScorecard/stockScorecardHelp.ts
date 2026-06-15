// Explicaciones educativas detalladas de cada sección/métrica del Stock Scorecard
// (popover "?"). Definición, cómo interpretarlo, lecturas positiva/neutral/negativa
// y por qué importa. Los textos NO cambian el cálculo del puntaje.

export interface ScorecardHelp {
  title: string;
  definition: string;
  interpretation: string;
  positiveReading: string;
  neutralReading: string;
  negativeReading: string;
  whyItMatters: string;
  sourceNotes?: string;
}

export const STOCK_SCORECARD_HELP: Record<string, ScorecardHelp> = {
  // ----- Secciones de puntaje -----
  overallScore: {
    title: "Puntaje general",
    definition:
      "Puntaje compuesto ponderado que combina los componentes técnico, fundamental, de noticias y de sentimiento según tus Ajustes de Scorecard.",
    interpretation:
      "Un puntaje más alto sugiere un setup más favorable según el modelo configurado; uno más bajo sugiere condiciones más débiles o riesgosas.",
    positiveReading:
      "Un puntaje alto con riesgo medio o bajo puede indicar un setup más fuerte.",
    neutralReading:
      "Un puntaje en rango medio suele significar señales mixtas o que falta confirmación.",
    negativeReading:
      "Un puntaje bajo puede indicar técnicos débiles, fundamentales pobres, sentimiento negativo o poco soporte de datos.",
    whyItMatters:
      "Resume varias dimensiones del análisis en una sola vista, sin dejar de permitir inspeccionar las métricas subyacentes.",
  },
  technicalScore: {
    title: "Puntaje técnico",
    definition:
      "Evalúa la tendencia de precio, el momentum, las medias móviles, la posición de volatilidad y el riesgo/beneficio basado en el gráfico.",
    interpretation:
      "Puntajes técnicos más altos suelen indicar una estructura de gráfico más fuerte; más bajos sugieren tendencia débil, mal momentum o riesgo/beneficio desfavorable.",
    positiveReading:
      "Precio por encima de medias clave, RSI constructivo, MACD positivo y riesgo/beneficio de canal favorable.",
    neutralReading: "Señales de tendencia o momentum mixtas.",
    negativeReading:
      "Precio por debajo de medias clave, momentum bajista, estructura débil o mal riesgo/beneficio.",
    whyItMatters:
      "La estructura técnica ayuda a evaluar el timing, la fuerza de la tendencia y posibles niveles de entrada/salida.",
  },
  fundamentalScore: {
    title: "Puntaje fundamental",
    definition:
      "Evalúa la calidad del negocio y la valuación con métricas disponibles: P/E, Precio/Ventas, rentabilidad, crecimiento, apalancamiento, liquidez y flujo de caja.",
    interpretation:
      "Puntajes más altos sugieren fundamentales más fuertes o una valuación más razonable según los umbrales seleccionados.",
    positiveReading:
      "Valuación razonable, fuerte rentabilidad, crecimiento saludable, deuda manejable y flujo de caja positivo.",
    neutralReading: "Valuación promedio y calidad del negocio mixta.",
    negativeReading:
      "Valuación cara sin suficiente crecimiento, rentabilidad débil, alto apalancamiento o flujo de caja pobre.",
    whyItMatters:
      "Los fundamentales ayudan a determinar si la calidad de la empresa y su valuación respaldan el setup técnico.",
  },
  newsScore: {
    title: "Puntaje de noticias",
    definition:
      "Mide el tono de los titulares recientes del símbolo (catalizadores positivos/negativos y frescura).",
    interpretation:
      "Titulares positivos pueden apoyar el precio; titulares negativos pueden añadir riesgo.",
    positiveReading: "Catalizadores recientes positivos y relevantes.",
    neutralReading: "Pocos titulares relevantes o tono mixto.",
    negativeReading: "Catalizadores negativos recientes o riesgo de titulares.",
    whyItMatters:
      "Las noticias pueden mover el precio en el corto plazo, pero no son una señal de compra/venta por sí solas.",
  },
  sentimentScore: {
    title: "Puntaje de sentimiento",
    definition:
      "Mide el entorno amplio del mercado y el apetito por el riesgo con insumos como el VIX, la tendencia de los índices y el proxy de sentimiento de mercado.",
    interpretation:
      "Puntajes más altos sugieren un telón de fondo de mercado más favorable; más bajos, condiciones risk-off.",
    positiveReading: "Volatilidad calmada, índices al alza y tono de mercado favorable.",
    neutralReading: "Condiciones de mercado mixtas o estables.",
    negativeReading: "Alta volatilidad, índices débiles o comportamiento risk-off.",
    whyItMatters:
      "Incluso las acciones fuertes pueden tener dificultades cuando el sentimiento amplio es débil.",
  },
  riskLevel: {
    title: "Nivel de riesgo",
    definition:
      "Estima cuánta cautela requiere el setup según la volatilidad, la extensión técnica, el riesgo de valuación, los catalizadores negativos y las condiciones de mercado.",
    interpretation:
      "Mayor riesgo implica que el setup puede requerir menor tamaño de posición, una invalidación más estricta o más confirmación.",
    positiveReading:
      "Riesgo bajo o medio con una invalidación clara y un riesgo/beneficio favorable.",
    neutralReading: "Riesgo medio con señales mixtas.",
    negativeReading:
      "Riesgo alto o muy alto por extensión, datos débiles, sentimiento pobre o gran incertidumbre.",
    whyItMatters:
      "El nivel de riesgo ayuda a no tratar todas las oportunidades como iguales.",
  },
  confidence: {
    title: "Nivel de confianza",
    definition:
      "Mide qué tan completos y fiables son los datos disponibles para el scorecard.",
    interpretation:
      "Confianza alta significa que más componentes tienen datos válidos; confianza baja significa que el puntaje puede ser menos fiable por datos faltantes o incompletos.",
    positiveReading:
      "Los datos técnicos, fundamentales, de noticias y de sentimiento están en su mayoría disponibles.",
    neutralReading: "Falta algún dato importante, pero el puntaje sigue siendo utilizable.",
    negativeReading:
      "Faltan demasiados datos, lo que hace que el puntaje sea menos fiable.",
    whyItMatters:
      "Un puntaje con baja confianza no debe tratarse igual que uno respaldado por datos completos.",
  },

  // ----- Métricas técnicas -----
  priceVsSma20: {
    title: "Precio vs SMA20",
    definition:
      "Compara el precio actual con la media móvil simple de 20 períodos, usada a menudo como referencia de tendencia de corto plazo.",
    interpretation:
      "Precio por encima de la SMA20 sugiere fuerza de corto plazo; por debajo, debilidad de corto plazo.",
    positiveReading: "El precio está por encima de la SMA20 y la SMA20 sube.",
    neutralReading: "El precio está cerca de la SMA20 o se mueve de lado.",
    negativeReading:
      "El precio está por debajo de la SMA20 o falla repetidamente en recuperarla.",
    whyItMatters:
      "La SMA20 ayuda a evaluar el momentum de corto plazo y si el precio está extendido o debilitándose.",
  },
  priceVsSma50: {
    title: "Precio vs SMA50",
    definition:
      "Compara el precio actual con la media móvil simple de 50 períodos, usada comúnmente como referencia de tendencia intermedia.",
    interpretation:
      "Precio por encima de la SMA50 suele apoyar una tendencia intermedia constructiva; por debajo puede avisar de deterioro.",
    positiveReading: "El precio está por encima de la SMA50 y la SMA50 sube.",
    neutralReading: "El precio está cerca de la SMA50 o se mueve de lado.",
    negativeReading: "El precio está por debajo de la SMA50 o la SMA50 se inclina a la baja.",
    whyItMatters:
      "La SMA50 es muy seguida por swing traders e instituciones como referencia de salud de la tendencia.",
  },
  priceVsSma200: {
    title: "Precio vs SMA200",
    definition:
      "Compara el precio actual con la media móvil simple de 200 períodos, usada comúnmente como referencia de tendencia de largo plazo.",
    interpretation:
      "Precio por encima de la SMA200 generalmente apoya una estructura alcista de largo plazo; por debajo puede indicar debilidad más amplia.",
    positiveReading: "El precio está por encima de la SMA200 y la SMA200 sube.",
    neutralReading: "El precio está cerca de la SMA200 sin dirección clara.",
    negativeReading: "El precio está por debajo de la SMA200 o la SMA200 declina.",
    whyItMatters:
      "La SMA200 ayuda a separar las tendencias alcistas de largo plazo de las bajistas más amplias.",
  },
  rsi14: {
    title: "RSI 14",
    definition:
      "El RSI 14 (Índice de Fuerza Relativa de 14 períodos) mide el momentum reciente del precio en una escala de 0 a 100.",
    interpretation:
      "Un RSI por encima de 50 suele mostrar momentum positivo; por debajo de 50, momentum más débil. Valores muy altos o muy bajos pueden señalar extensión.",
    positiveReading: "RSI entre 45 y 65 con precio al alza puede ser constructivo.",
    neutralReading: "RSI alrededor de 50 sugiere momentum equilibrado.",
    negativeReading:
      "RSI por encima de 70-75 puede indicar sobrecompra/extensión; por debajo de 30, sobreventa pero también debilidad.",
    whyItMatters:
      "El RSI ayuda a juzgar si el momentum del precio apoya la tendencia o si la acción puede estar estirada.",
  },
  macd: {
    title: "MACD",
    definition:
      "El MACD (Convergencia/Divergencia de Medias Móviles) compara medias móviles de corto y largo plazo para medir cambios de momentum.",
    interpretation:
      "Una señal MACD alcista sugiere momentum que mejora; una bajista sugiere momentum que se debilita.",
    positiveReading: "Línea MACD por encima de la señal o moviéndose al alza.",
    neutralReading: "MACD plano o cerca de la línea de señal.",
    negativeReading: "Línea MACD por debajo de la señal o moviéndose a la baja.",
    whyItMatters:
      "El MACD ayuda a identificar cambios de momentum que pueden confirmar o debilitar una tendencia.",
  },
  bollingerPosition: {
    title: "Posición en Bollinger",
    definition:
      "Muestra dónde se ubica el precio respecto a las Bandas de Bollinger, que son bandas de volatilidad alrededor de una media móvil.",
    interpretation:
      "Cerca de la banda superior puede indicar fuerza o extensión; cerca de la inferior, debilidad o sobreventa.",
    positiveReading: "El precio se mantiene por encima de la banda media y tiende al alza.",
    neutralReading: "El precio se mueve alrededor de la banda media.",
    negativeReading:
      "El precio rompe por debajo de la banda media o recorre la banda inferior con momentum débil.",
    whyItMatters:
      "Las Bandas de Bollinger ayudan a evaluar la volatilidad, la extensión y una posible reversión a la media.",
  },
  channelRiskReward: {
    title: "Riesgo/Beneficio de canal",
    definition:
      "Estima el potencial al alza hasta el canal superior dibujado frente al riesgo a la baja hasta el canal inferior.",
    interpretation:
      "Un ratio beneficio/riesgo más alto significa que el potencial al alza es mayor que el riesgo a la baja según el canal seleccionado.",
    positiveReading: "Ratio por encima de 2:1 o 3:1, con el precio cerca de soporte y un canal válido.",
    neutralReading: "Ratio alrededor de 1.5:1 a 2:1 o calidad del canal incierta.",
    negativeReading:
      "Ratio por debajo de 1:1 o precio cerca del canal superior con poco recorrido al alza.",
    whyItMatters:
      "Ayuda a evaluar si el setup técnico ofrece suficiente beneficio potencial para el riesgo que se asume.",
  },

  // ----- Métricas fundamentales -----
  peRatio: {
    title: "P/E (Precio/Beneficio)",
    definition:
      "El P/E (Precio/Beneficio) compara el precio de la acción con su beneficio por acción.",
    interpretation:
      "Un P/E más bajo puede sugerir una valuación más barata; uno más alto puede sugerir que el mercado espera mayor crecimiento futuro.",
    positiveReading: "P/E bajo o razonable respecto al crecimiento, la rentabilidad y el sector.",
    neutralReading: "P/E en línea con el crecimiento de la empresa y el sector.",
    negativeReading:
      "Un P/E muy alto sin suficiente crecimiento indica riesgo de valuación; un P/E negativo o ausente indica pérdidas o datos faltantes.",
    whyItMatters:
      "El P/E ayuda a juzgar cuánto se paga por cada dólar de beneficio de la empresa.",
  },
  forwardPe: {
    title: "Forward P/E",
    definition:
      "El Forward P/E compara el precio de la acción con el beneficio por acción FUTURO esperado.",
    interpretation:
      "Refleja las expectativas del mercado para la rentabilidad futura; puede diferir del P/E pasado si se espera que los beneficios crezcan o caigan.",
    positiveReading: "Forward P/E razonable o menor que el P/E pasado por crecimiento esperado de beneficios.",
    neutralReading: "Forward P/E en línea con las normas históricas o del sector.",
    negativeReading: "Forward P/E sigue alto a pesar de expectativas de crecimiento débil.",
    whyItMatters:
      "Ayuda a evaluar si las expectativas de beneficios futuros respaldan el precio actual.",
  },
  priceSales: {
    title: "Precio/Ventas",
    definition: "El Precio/Ventas compara el valor de mercado de la empresa con sus ingresos.",
    interpretation:
      "Un Precio/Ventas más bajo puede indicar valuación más barata, pero los márgenes y el crecimiento son críticos.",
    positiveReading: "Precio/Ventas razonable con márgenes y crecimiento fuertes.",
    neutralReading: "Precio/Ventas promedio para el sector.",
    negativeReading: "Precio/Ventas alto con márgenes débiles o crecimiento en desaceleración.",
    whyItMatters:
      "Es útil cuando los beneficios son bajos, volátiles o negativos.",
  },
  priceBook: {
    title: "Precio/Valor en libros",
    definition:
      "El Precio/Valor en libros compara el valor de mercado de la empresa con su valor contable.",
    interpretation:
      "Un Precio/Libros más bajo puede indicar valuación más barata, pero depende mucho del modelo de negocio.",
    positiveReading: "Precio/Libros razonable para bancos, aseguradoras o empresas con muchos activos.",
    neutralReading: "Precio/Libros en línea con las normas del sector.",
    negativeReading:
      "Precio/Libros alto sin retornos fuertes, o muy bajo por deterioro del negocio.",
    whyItMatters:
      "Útil para financieras y empresas intensivas en activos; menos útil para software o negocios de marca.",
  },
  roe: {
    title: "ROE (Retorno sobre capital)",
    definition:
      "El ROE mide el beneficio neto generado por cada dólar de capital de los accionistas.",
    interpretation:
      "Un ROE más alto generalmente significa que la empresa usa el capital de los accionistas de forma eficiente.",
    positiveReading: "ROE por encima del umbral bueno/excelente configurado.",
    neutralReading: "ROE positivo pero no especialmente fuerte.",
    negativeReading: "ROE bajo o negativo puede indicar rentabilidad pobre o uso ineficiente del capital.",
    whyItMatters:
      "El ROE ayuda a evaluar la calidad del negocio y la eficiencia de la gestión.",
  },
  roa: {
    title: "ROA (Retorno sobre activos)",
    definition:
      "El ROA mide el beneficio neto generado en relación con los activos totales.",
    interpretation:
      "Un ROA más alto significa que la empresa genera más beneficio a partir de su base de activos.",
    positiveReading: "ROA alto respecto al sector.",
    neutralReading: "ROA positivo pero promedio.",
    negativeReading: "ROA bajo o negativo muestra eficiencia de activos débil.",
    whyItMatters:
      "El ROA es especialmente útil para comparar negocios intensivos en capital.",
  },
  profitMargin: {
    title: "Margen neto",
    definition:
      "El margen neto mide el porcentaje de los ingresos que se convierte en beneficio neto.",
    interpretation:
      "Un margen más alto significa que la empresa retiene más beneficio de cada dólar de ventas.",
    positiveReading: "Márgenes altos y estables o en mejora.",
    neutralReading: "Márgenes promedio o estables.",
    negativeReading:
      "Márgenes bajos o en caída pueden indicar presión de costos, debilidad de precios o de demanda.",
    whyItMatters:
      "Los márgenes afectan la calidad de las ganancias y la capacidad de resistir presiones económicas.",
  },
  operatingMargin: {
    title: "Margen operativo",
    definition:
      "El margen operativo mide el beneficio de las operaciones principales antes de intereses e impuestos, como porcentaje de los ingresos.",
    interpretation:
      "Muestra qué tan eficiente es el negocio principal antes de los efectos de financiamiento e impuestos.",
    positiveReading: "Margen operativo alto o en mejora.",
    neutralReading: "Margen operativo estable.",
    negativeReading: "Un margen operativo en caída puede señalar menor eficiencia o costos al alza.",
    whyItMatters:
      "Ayuda a separar el desempeño del negocio de la estructura de financiamiento.",
  },
  revenueGrowth: {
    title: "Crecimiento de ingresos",
    definition: "Mide cuánto aumentan o disminuyen las ventas de la empresa.",
    interpretation:
      "Un crecimiento positivo significa que la empresa vende más; negativo, que las ventas se reducen.",
    positiveReading: "Crecimiento de ingresos fuerte y sostenible.",
    neutralReading: "Crecimiento de ingresos modesto o estable.",
    negativeReading: "Crecimiento de ingresos que se frena bruscamente o es negativo.",
    whyItMatters:
      "El crecimiento de ingresos respalda las ganancias futuras, la valuación y la expansión del negocio.",
  },
  earningsGrowth: {
    title: "Crecimiento de beneficios",
    definition: "Mide cuánto aumentan o disminuyen los beneficios de la empresa.",
    interpretation:
      "Beneficios crecientes pueden apoyar precios más altos; beneficios en caída pueden presionar la valuación.",
    positiveReading: "Crecimiento de beneficios fuerte y respaldado por ingresos y márgenes.",
    neutralReading: "Crecimiento de beneficios modesto o mixto.",
    negativeReading: "Beneficios en declive o crecimiento impulsado solo por partidas puntuales.",
    whyItMatters:
      "Los precios de las acciones dependen en gran medida de las expectativas de beneficios.",
  },
  debtToEquity: {
    title: "Deuda/Capital",
    definition:
      "El Deuda/Capital compara la deuda de la empresa con el capital de los accionistas.",
    interpretation:
      "Un Deuda/Capital más alto significa más apalancamiento financiero; más bajo, normalmente menos riesgo de balance.",
    positiveReading: "Deuda/Capital bajo o manejable para el sector.",
    neutralReading: "Deuda/Capital moderado y respaldado por el flujo de caja.",
    negativeReading: "Un Deuda/Capital muy alto puede aumentar el riesgo, sobre todo con tasas altas.",
    whyItMatters:
      "El apalancamiento puede amplificar los retornos, pero también incrementa el riesgo financiero.",
  },
  currentRatio: {
    title: "Razón corriente",
    definition: "La razón corriente compara los activos corrientes con los pasivos corrientes.",
    interpretation: "Un ratio por encima de 1 significa que los activos corrientes superan a los pasivos corrientes.",
    positiveReading:
      "Razón corriente cómodamente por encima de 1 (suele rondar 1.5 o más según el sector).",
    neutralReading: "Razón corriente cerca de niveles aceptables.",
    negativeReading: "Razón corriente por debajo de 1 puede indicar riesgo de liquidez de corto plazo.",
    whyItMatters:
      "Ayuda a evaluar si la empresa puede cumplir con sus obligaciones de corto plazo.",
  },
  freeCashflow: {
    title: "Flujo de caja libre",
    definition:
      "El flujo de caja libre es el efectivo que queda tras el flujo de caja operativo menos los gastos de capital.",
    interpretation:
      "Un flujo de caja libre positivo significa que la empresa genera efectivo después de reinvertir en el negocio.",
    positiveReading: "Flujo de caja libre fuerte y consistentemente positivo.",
    neutralReading: "Flujo de caja libre positivo pero inconsistente.",
    negativeReading:
      "Un flujo de caja libre negativo puede indicar fuerte inversión, rentabilidad débil o necesidades de financiamiento.",
    whyItMatters:
      "El flujo de caja libre respalda la reducción de deuda, las recompras, los dividendos, las adquisiciones y la reinversión.",
  },

  // ----- Métricas de sentimiento -----
  sentiment: {
    title: "Sentimiento",
    definition: "Mide el ánimo general del mercado o el apetito por el riesgo.",
    interpretation:
      "Un sentimiento positivo significa más disposición a tomar riesgo; negativo, más cautela.",
    positiveReading: "Índices principales al alza, volatilidad baja o a la baja y amplitud favorable.",
    neutralReading: "Desempeño mixto de los índices y volatilidad estable.",
    negativeReading: "Índices a la baja, volatilidad al alza y comportamiento defensivo.",
    whyItMatters:
      "El sentimiento amplio puede apoyar o presionar los setups de acciones individuales.",
  },
  vix: {
    title: "VIX",
    definition:
      "El VIX mide la volatilidad esperada del S&P 500 según el precio de las opciones.",
    interpretation:
      "Un VIX más alto significa que el mercado espera mayores oscilaciones de precio; más bajo, condiciones más calmadas.",
    positiveReading: "El VIX es moderado o a la baja.",
    neutralReading: "El VIX es estable.",
    negativeReading: "El VIX sube bruscamente o se mantiene elevado.",
    whyItMatters:
      "El VIX afecta la gestión de riesgo, el tamaño de las posiciones, el precio de las opciones y la confianza en los setups técnicos.",
  },
  marketSentimentProxy: {
    title: "Proxy de sentimiento de mercado",
    definition:
      "Puntaje interno basado en datos disponibles como el VIX, la dirección de los índices principales, los movers del mercado y el tono de las noticias.",
    interpretation:
      "Valores más altos sugieren condiciones de mercado más favorables; más bajos, condiciones risk-off.",
    positiveReading: "Puntaje alto con amplia participación de los índices y baja volatilidad.",
    neutralReading: "Puntaje en rango medio o mixto.",
    negativeReading: "Puntaje bajo por índices débiles, VIX alto o tono de mercado negativo.",
    whyItMatters:
      "Aporta contexto de mercado al scorecard de la acción, pero no es una señal de compra/venta por sí sola.",
  },
};
