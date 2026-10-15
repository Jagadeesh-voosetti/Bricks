export const BRICK_PRODUCTS = [
  {
    id: "brick-1",
    name: "Standard Red Clay Bricks",
    teluguName: "సాధారణ ఎర్ర మట్టి ఇటుకలు",
    type: "First Class Red Clay",
    stock: "18,000",
    price: 8.50,
    priceFormatted: "₹8.50",
    quality: "First Class Kiln Burnt (9\" x 4\" x 3\")",
    compressiveStrength: "3.5 - 5.0 N/mm²",
    supplier: "Sri Venkateswara Brick Works",
    supplierLocation: "Belagam, Parvathipuram",
    color: "#b84a27",
    isSample: true
  },
  {
    id: "brick-2",
    name: "Premium Table-Moulded Red Bricks",
    teluguName: "ప్రీమియం టేబుల్ మోల్డెడ్ ఇటుకలు",
    type: "Heavy Load-Bearing",
    stock: "12,500",
    price: 10.20,
    priceFormatted: "₹10.20",
    quality: "Dense clay, sharp edges, tested sample grade",
    compressiveStrength: "7.5 - 10.0 N/mm²",
    supplier: "Balaji Kiln Industries",
    supplierLocation: "Balagudaba Road, Parvathipuram",
    color: "#9f3818",
    isSample: true
  },
  {
    id: "brick-3",
    name: "Wirecut Smooth Finish Bricks",
    teluguName: "వైర్‌కట్ స్మూత్ ఫినిష్ ఇటుకలు",
    type: "Exposed Masonry",
    stock: "8,000",
    price: 12.50,
    priceFormatted: "₹12.50",
    quality: "Precision cut, minimal mortar joints, architectural grade",
    compressiveStrength: "10.0+ N/mm²",
    supplier: "Manyam Clay Products",
    supplierLocation: "Salur Highway, Manyam Dist",
    color: "#a44222",
    isSample: true
  },
  {
    id: "brick-4",
    name: "Fly Ash High-Strength Bricks",
    teluguName: "ఫ్లై యాష్ సిమెంట్ ఇటుకలు",
    type: "Eco-Friendly Cement-Ash",
    stock: "32,000",
    price: 6.80,
    priceFormatted: "₹6.80",
    quality: "Uniform machine finish, zero efflorescence, rapid setting",
    compressiveStrength: "5.0 - 7.5 N/mm²",
    supplier: "GreenTech Eco Bricks",
    supplierLocation: "Industrial Estate, Parvathipuram",
    color: "#6c7a89",
    isSample: true
  },
  {
    id: "brick-5",
    name: "Economy Red Clay Bricks",
    teluguName: "ఎకానమీ ఎర్ర ఇటుకలు",
    type: "Second Class Kiln Burnt",
    stock: "24,000",
    price: 7.50,
    priceFormatted: "₹7.50",
    quality: "Budget construction, compound walls & temporary structures",
    compressiveStrength: "2.5 - 3.5 N/mm²",
    supplier: "Lakshmi Narasimha Kilns",
    supplierLocation: "Seethanagaram Road, Parvathipuram",
    color: "#c25e36",
    isSample: true
  }
];

export const TRANSPORT_OPTIONS = [
  {
    id: "lorry-heavy",
    title: "10-12 Wheeler Heavy Lorry",
    teluguTitle: "భారీ లారీ (10-12 వీలర్)",
    icon: "🚛",
    capacity: "5,000 - 8,000 Bricks",
    bestFor: "Commercial construction, apartment foundations & wholesale shipments.",
    routeAccess: "Requires wide main roads; unsuitable for narrow interior colony lanes.",
    estimatedChargeNote: "Fixed base fee + distance (₹/km). Unloading extra by labor gang."
  },
  {
    id: "lorry-mini",
    title: "6-Wheeler Medium Tipper",
    teluguTitle: "మీడియం టిప్పర్ లారీ (6-వీలర్)",
    icon: "🚚",
    capacity: "3,000 - 4,000 Bricks",
    bestFor: "Independent residential houses, duplex villas and boundary walls.",
    routeAccess: "Suitable for standard municipal roads and town layouts.",
    estimatedChargeNote: "Distance-based quotation agreed before dispatch."
  },
  {
    id: "tractor",
    title: "Agricultural Tractor Trailer",
    teluguTitle: "ట్రాక్టర్ ట్రాలీ",
    icon: "🚜",
    capacity: "1,500 - 2,500 Bricks",
    bestFor: "Most popular choice in Parvathipuram; handles mud tracks, unpaved rural roads.",
    routeAccess: "High ground clearance, navigates rough village approaches easily.",
    estimatedChargeNote: "Trip-based local charges confirmed directly with driver/kiln."
  },
  {
    id: "auto-cargo",
    title: "Cargo 3-Wheeler Auto (Piaggio / Ape)",
    teluguTitle: "కార్గో ఆటో",
    icon: "🛺",
    capacity: "500 - 800 Bricks",
    bestFor: "Small renovation works, bathroom additions, or emergency replenishment.",
    routeAccess: "Navigates narrow town streets and congested market alleys.",
    estimatedChargeNote: "Economical short-haul trip charge within town limits."
  },
  {
    id: "bullock-cart",
    title: "Yeddula Bandi (Bullock Cart)",
    teluguTitle: "ఎడ్ల బండి (సాంప్రదాయ రవాణా)",
    icon: "🐂",
    capacity: "300 - 500 Bricks",
    bestFor: "Zero motor vehicle emissions, steep agrarian slopes or short local lane deliveries.",
    routeAccess: "Best for immediate village localities where trucks cannot turn.",
    estimatedChargeNote: "Locally negotiated per-trip charge with cart owner."
  },
  {
    id: "self-pickup",
    title: "Own vehicle",
    teluguTitle: "రవాణా వద్దు — నా వాహనంతో నేనే వస్తాను",
    icon: "🚙",
    selfArranged: true
  }
];

export const PRICE_COMPARISONS = [
  {
    type: "Standard Red Clay",
    ratePer1000: "₹8,500",
    transportEstimate: "₹800 - ₹1,400 per 1000 (distance dependent)",
    usage: "General house construction & load-bearing brickwork"
  },
  {
    type: "Premium Table-Moulded",
    ratePer1000: "₹10,200",
    transportEstimate: "₹800 - ₹1,400 per 1000",
    usage: "Multi-storey columns, exterior walls, premium homes"
  },
  {
    type: "Wirecut Red Bricks",
    ratePer1000: "₹12,500",
    transportEstimate: "₹1,000 - ₹1,600 per 1000",
    usage: "Architectural exposed facades, luxury projects"
  },
  {
    type: "Fly Ash Cement Bricks",
    ratePer1000: "₹6,800",
    transportEstimate: "₹700 - ₹1,200 per 1000",
    usage: "Partition walls, multi-tier frames, budget builds"
  },
  {
    type: "Economy Red Bricks",
    ratePer1000: "₹7,500",
    transportEstimate: "₹800 - ₹1,300 per 1000",
    usage: "Compound walls, sheds, secondary partitions"
  }
];
