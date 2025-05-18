let rawData = [];

// Initialize visualizations when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Load CSV data using d3.csv() method
  d3.csv("cosmetics.csv").then(function(data) {
    rawData = data;
    // Draw all visualizations using D3
    drawBarChart(data);
    drawIngredientTreemap(data);
    drawSankey(data);
    setupFilter();
  }).catch(function(error) {
    console.error("Error loading data:", error);
  });
});

function drawBarChart(data) {
  // Define chart margins
  const margin = {top: 60, right: 20, bottom: 100, left: 60};
  
  // Select container div 
  const container = d3.select("#bar-chart");
  
  // Get container width using D3's node() method
  const containerWidth = container.node().getBoundingClientRect().width;
  const width = containerWidth - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;
  container.html("");

  // Sort by product count using d3.descending
  const brands = Array.from(new Set(data.map(d => d.Brand)))
    .filter(Boolean)
    .sort((a, b) => d3.descending(
      data.filter(d => d.Brand === a).length,
      data.filter(d => d.Brand === b).length
    ))
    .slice(0, 10);

  // Define skin types
  const skinTypes = ["Combination", "Dry", "Normal", "Oily", "Sensitive"];
  
  // Create ordinal color scale
  const colorScale = d3.scaleOrdinal()
    .domain(skinTypes)
    .range(["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f"]);

  // Prepare data for grouped bars
  const brandData = brands.map(brand => {
    const brandProducts = data.filter(d => d.Brand === brand);
    return {
      brand,
      counts: skinTypes.map(skinType => ({
        skinType,
        count: brandProducts.filter(d => d[skinType] === "1" || d[skinType] === 1).length
      }))
    };
  });

  // Create tooltip div
  const tooltip = d3.select("body").append("div")
    .attr("class", "bar-chart-tooltip tooltip")
    .style("opacity", 0);

  // Create D3 scales:
  const x0 = d3.scaleBand()
    .domain(brands)
    .range([0, width])
    .padding(0.2);

  // x1 - nested band scale for skin types
  const x1 = d3.scaleBand()
    .domain(skinTypes)
    .range([0, x0.bandwidth()])
    .padding(0.1);

  // y - linear scale for counts
  const y = d3.scaleLinear()
    .domain([0, d3.max(brandData, d => d3.max(d.counts, c => c.count))])
    .nice()
    .range([height, 0]);

  // Create SVG container
  const svg = container.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`)
    .attr("preserveAspectRatio", "xMinYMin meet")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Add legend
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width / 2 - (skinTypes.length * 50) / 2}, -30)`);

  // Add legend items using D3's data binding
  skinTypes.forEach((skinType, i) => {
    const legendItem = legend.append("g")
      .attr("transform", `translate(${i * 90}, 0)`);
    
    // Add colored rectangle for each legend item
    legendItem.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", colorScale(skinType));

    // Add text label for each legend item
    legendItem.append("text")
      .attr("x", 15)
      .attr("y", 10)
      .text(skinType)
      .style("font-size", "10px");
  });

  // Create bar groups
  const brandGroups = svg.selectAll(".brand-group")
    .data(brandData)
    .enter().append("g")
    .attr("class", "brand-group")
    .attr("transform", d => `translate(${x0(d.brand)},0)`);

  // Create bars within each group
  brandGroups.selectAll(".bar")
    .data(d => d.counts)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("x", d => x1(d.skinType))
    .attr("y", d => y(d.count))
    .attr("width", x1.bandwidth())
    .attr("height", d => height - y(d.count))
    .attr("fill", d => colorScale(d.skinType))
    .on("mouseover", function(event, d) {
      // D3 mouseover interaction
      d3.select(this).attr("opacity", 0.7);
      tooltip.html(`<strong>${d.skinType} Skin</strong><br/>Total: <strong>${d.count}</strong>`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px")
        .style("opacity", 0.9);
    })      
    .on("mouseout", function() {
      // mouseout interaction
      d3.select(this).attr("opacity", 1);
      tooltip.style("opacity", 0);
    });

  // Add x-axis
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end")
    .style("font-size", "10px");

  // Add y-axis
  svg.append("g").call(d3.axisLeft(y));

  // Add x-axis label 
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom + 10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Brand Name");

  // Add y-axis label 
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 15)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Number of Products");
}

function drawIngredientTreemap(data) {
  // Select container
  const container = d3.select("#ingredients-treemap");
  const containerWidth = container.node().getBoundingClientRect().width;
  const height = 400;
  const width = containerWidth;
  const topMargin = 80;
  container.html("");

  // Count ingredient frequency
  const ingredientCounts = {};
  data.forEach(d => {
    const ingredients = d.Ingredients ? d.Ingredients.split(",").map(s => s.trim()) : [];
    new Set(ingredients).forEach(ing => {
      if (ing) ingredientCounts[ing] = (ingredientCounts[ing] || 0) + 1;
    });
  });

  // Get top 25 ingredients 
  const topIngredients = Object.entries(ingredientCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([name, count]) => ({ name, value: count }));

  // Create hierarchy for treemap
  const root = d3.hierarchy({ children: topIngredients }).sum(d => d.value);
  
  // Create treemap layout
  d3.treemap()
    .size([width, height - topMargin])
    .padding(3)(root);

  // Create color scale
  const maxValue = d3.max(topIngredients, d => d.value);
  const color = d3.scaleSequential(d3.interpolateBlues).domain([0, maxValue]);

  // Create SVG container 
  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height + 20);

  // Create tooltip 
  const tooltip = d3.select("body").append("div")
    .attr("class", "treemap-tooltip tooltip")
    .style("opacity", 0);

  // Add legend 
  const legendWidth = 200;
  const legendHeight = 20;
  const legendMargin = { left: width - legendWidth - 20, top: 10 };

  // Add legend title 
  svg.append("text")
    .attr("x", legendMargin.left + legendWidth/2)
    .attr("y", legendMargin.top - 5)
    .attr("text-anchor", "middle")
    .style("font-size", "7.5px")
    .style("font-weight", "bold")
    .text("Ingredient Frequency");

  // Create gradient 
  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", "treemap-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%");

  // Add gradient stops 
  gradient.append("stop").attr("offset", "0%").attr("stop-color", d3.interpolateBlues(0));
  gradient.append("stop").attr("offset", "100%").attr("stop-color", d3.interpolateBlues(1));

  // Add gradient bar
  svg.append("rect")
    .attr("x", legendMargin.left)
    .attr("y", legendMargin.top)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#treemap-gradient)");

  // Create legend scale
  const legendScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([0, legendWidth]);

  // Add legend axis 
  svg.append("g")
    .attr("transform", `translate(${legendMargin.left},${legendMargin.top + legendHeight})`)
    .call(d3.axisBottom(legendScale).ticks(5))
    .selectAll("text")
    .style("font-size", "9px");

  // Create treemap group 
  const treemapGroup = svg.append("g")
    .attr("transform", `translate(0,${topMargin - 20})`);

  // Create treemap rectangles
  treemapGroup.selectAll("g")
    .data(root.leaves())
    .enter()
    .append("g")
    .attr("transform", d => `translate(${d.x0},${d.y0})`)
    .append("rect")
    .attr("width", d => d.x1 - d.x0)
    .attr("height", d => d.y1 - d.y0)
    .attr("fill", d => color(d.data.value))
    .on("mouseover", function(event, d) {
      // D3 mouseover interaction
      d3.select(this).attr("stroke", "#333").attr("stroke-width", 1.5);
      tooltip.html(`<strong>${d.data.name}</strong><br/>Used in ${d.data.value} product${d.data.value > 1 ? "s" : ""}`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px")
        .style("opacity", 0.9);
    })
    .on("mouseout", function() {
      // D3 mouseout interaction
      d3.select(this).attr("stroke", null);
      tooltip.style("opacity", 0);
    });

  // Add labels to treemap 
  treemapGroup.selectAll("g")
    .append("text")
    .attr("x", 4)
    .attr("y", 14)
    .text(d => d.data.name.length > 20 ? d.data.name.slice(0, 17) + "..." : d.data.name)
    .style("font-size", "12px")
    .style("font-weight", "bold");
}

function drawSankey(data) {
  // Sankey dimensions
  const svgWidth = 1200;
  let svgHeight = 800;
  const nodeHeight = 20;
  const nodeSpacing = 10;
  const rightColumnX = 500;
  const rightColumnYOffset = 150;
  const rightNodeSpacing = 250;
  const rankColumnX = 800;
  const rankColumnYOffset = 300;
  const rankNodeSpacing = 150;
  const nodeWidth = 120;
  const fontSize = "10px";
  const topMargin = 50;

  // color scale for links
  const linkColorScale = d3.scaleOrdinal()
    .domain(["Low (0-3)", "Medium (3-4)", "High (4-5)"])
    .range(["#B30019", "#51DBFF", "#F2698B"]);
  d3.select("#sankey-chart").html("");

  // Create tooltip 
  const tooltip = d3.select("body").append("div")
    .attr("class", "sankey-tooltip tooltip")
    .style("opacity", 0);

  // Create SVG container 
  const sankeySvg = d3.select("#sankey-chart")
    .append("svg")
    .attr("width", "100%")
    .attr("height", svgHeight)
    .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .attr("preserveAspectRatio", "xMinYMin meet");

  // price ranges 
  const priceRanges = [
    { name: "Low ($0-50)", min: 0, max: 50 },
    { name: "Medium ($50-100)", min: 50, max: 100 },
    { name: "High ($100-200)", min: 100, max: 200 },
    { name: "Premium ($200+)", min: 200, max: Infinity }
  ];

  // rank categories 
  const rankCategories = [
    { name: "Low (0-3)", min: 0, max: 3 },
    { name: "Medium (3-4)", min: 3, max: 4 },
    { name: "High (4-5)", min: 4, max: 5 }
  ];

  // Process brand data
  const brands = Array.from(new Set(data.map(d => d.Brand))).filter(Boolean).sort();
  let brandToPriceLinks = [];
  let priceToRankLinks = [];

  // Calculate dynamic height 
  svgHeight = topMargin + (brands.length * (nodeHeight + nodeSpacing)) + 200;
  sankeySvg.attr("height", svgHeight).attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

  function getPriceRangeIndex(price) {
    const num = +price;
    return priceRanges.findIndex(r => num >= r.min && num < r.max);
  }

  // function to get rank index
  function getRankIndex(rank) {
    const num = +rank;
    return rankCategories.findIndex(r => num >= r.min && num < r.max);
  }

  // Build links from brands to price ranges
  const brandToPriceMap = new Map();
  data.forEach(item => {
    const brandIndex = brands.indexOf(item.Brand);
    const priceRangeIndex = getPriceRangeIndex(item.Price);
    if (brandIndex >= 0 && priceRangeIndex >= 0) {
      const key = `${brandIndex}-${priceRangeIndex}`;
      brandToPriceMap.set(key, (brandToPriceMap.get(key) || 0) + 1);
    }
  });

  for (const [key, value] of brandToPriceMap.entries()) {
    const [brandIndex, priceRangeIndex] = key.split("-").map(Number);
    brandToPriceLinks.push({
      source: brandIndex,
      target: priceRangeIndex + brands.length,
      value: value,
      brand: brands[brandIndex]
    });
  }

  // Build links from price ranges to rank categories 
  const priceToRankMap = new Map();
  data.forEach(item => {
    const priceRangeIndex = getPriceRangeIndex(item.Price);
    const rankIndex = getRankIndex(item.Rank);
    if (priceRangeIndex >= 0 && rankIndex >= 0) {
      const key = `${priceRangeIndex}-${rankIndex}`;
      priceToRankMap.set(key, (priceToRankMap.get(key) || 0) + 1);
    }
  });

  for (const [key, value] of priceToRankMap.entries()) {
    const [priceRangeIndex, rankIndex] = key.split("-").map(Number);
    priceToRankLinks.push({
      source: priceRangeIndex + brands.length,
      target: rankIndex + brands.length + priceRanges.length,
      value: value,
      rankName: rankCategories[rankIndex].name
    });
  }

  // Draw brand nodes 
  sankeySvg.selectAll(".brandRect")
    .data(brands)
    .enter()
    .append("rect")
    .attr("class", "brandRect")
    .attr("x", 80)
    .attr("y", (d, i) => topMargin + i * (nodeHeight + nodeSpacing))
    .attr("width", nodeWidth)
    .attr("height", nodeHeight)
    .attr("fill", "#006F60")
    .on("click", function(event, d) {
      highlightConnections(d);
    });

  // Draw price range nodes 
  const priceRangeNames = priceRanges.map(d => d.name);
  sankeySvg.selectAll(".priceRect")
    .data(priceRangeNames)
    .enter()
    .append("rect")
    .attr("class", "priceRect")
    .attr("x", rightColumnX)
    .attr("y", (d, i) => rightColumnYOffset + i * (nodeHeight + rightNodeSpacing))
    .attr("width", nodeWidth)
    .attr("height", nodeHeight)
    .attr("fill", "#0065A2");

  // Draw rank nodes 
  const rankNames = rankCategories.map(d => d.name);
  sankeySvg.selectAll(".rankRect")
    .data(rankNames)
    .enter()
    .append("rect")
    .attr("class", "rankRect")
    .attr("x", rankColumnX)
    .attr("y", (d, i) => rankColumnYOffset + i * (nodeHeight + rankNodeSpacing))
    .attr("width", nodeWidth)
    .attr("height", nodeHeight)
    .attr("fill", "#FFBF65");

  // Draw links from brands to price ranges 
  brandToPriceLinks.forEach((link, i) => {
    const sourceX = 80 + nodeWidth;
    const sourceY = topMargin + link.source * (nodeHeight + nodeSpacing) + nodeHeight / 2;
    const targetX = rightColumnX;
    const targetY = rightColumnYOffset + (link.target - brands.length) * (nodeHeight + rightNodeSpacing) + nodeHeight / 2;

    sankeySvg.append("path")
      .attr("class", "brandToPriceLink")
      .attr("d", d3.linkHorizontal()({
        source: [sourceX, sourceY],
        target: [targetX, targetY]
      }))
      .attr("stroke", "#888")
      .attr("stroke-width", Math.max(1, Math.sqrt(link.value)))
      .attr("fill", "none")
      .attr("stroke-opacity", 0.7);
  });

  // Draw links from price ranges to ranks 
  priceToRankLinks.forEach((link, i) => {
    const sourceX = rightColumnX + nodeWidth;
    const sourceY = rightColumnYOffset + (link.source - brands.length) * (nodeHeight + rightNodeSpacing) + nodeHeight / 2;
    const targetX = rankColumnX;
    const targetY = rankColumnYOffset + (link.target - brands.length - priceRanges.length) * (nodeHeight + rankNodeSpacing) + nodeHeight / 2;

    sankeySvg.append("path")
      .attr("class", "priceToRankLink")
      .attr("d", d3.linkHorizontal()({
        source: [sourceX, sourceY],
        target: [targetX, targetY]
      }))
      .attr("stroke", linkColorScale(link.rankName))
      .attr("stroke-width", Math.max(1, Math.sqrt(link.value)))
      .attr("fill", "none")
      .attr("stroke-opacity", 0.7);
  });

  // function to draw labels 
  function drawLabels(selector, data, xPos, yOffset, spacing, color = "white") {
    sankeySvg.selectAll(selector)
      .data(data)
      .enter()
      .append("text")
      .attr("x", xPos + 5)
      .attr("y", (d, i) => yOffset + i * (nodeHeight + spacing) + nodeHeight / 2)
      .text(d => d)
      .attr("fill", color)
      .attr("font-size", fontSize)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "start");
  }

  // Draw labels for all columns 
  drawLabels(".brandText", brands, 80, topMargin, nodeSpacing);
  drawLabels(".priceText", priceRangeNames, rightColumnX, rightColumnYOffset, rightNodeSpacing);
  drawLabels(".rankText", rankNames, rankColumnX, rankColumnYOffset, rankNodeSpacing);

  // Add column titles 
  sankeySvg.append("text")
    .attr("x", 80 + nodeWidth / 2)
    .attr("y", topMargin - 20)
    .attr("text-anchor", "middle")
    .style("font-size", "15px")
    .style("font-weight", "bold")
    .text("Brands");

  sankeySvg.append("text")
    .attr("x", rightColumnX + nodeWidth / 2)
    .attr("y", rightColumnYOffset - 20)
    .attr("text-anchor", "middle")
    .style("font-size", "15px")
    .style("font-weight", "bold")
    .text("Price Ranges");

  sankeySvg.append("text")
    .attr("x", rankColumnX + nodeWidth / 2)
    .attr("y", rankColumnYOffset - 20)
    .attr("text-anchor", "middle")
    .style("font-size", "15px")
    .style("font-weight", "bold")
    .text("Rating Categories");

  // Add instructions
  sankeySvg.append("text")
    .attr("x", 0)
    .attr("y", 10)
    .attr("text-anchor", "start")
    .style("font-size", "14px")
    .style("fill", "red")
    .text("\* Click on any brand(sorted) to highlight its price range and customer rating relationships.");

  // Highlight connections function
  function highlightConnections(brandName) {
    sankeySvg.selectAll(".neon-highlight, .neon-highlight-fill, .faded")
      .classed("neon-highlight", false)
      .classed("neon-highlight-fill", false)
      .classed("faded", false)
      .attr("opacity", 1);
    
    sankeySvg.selectAll(".brandRect")
      .filter(d => d === brandName)
      .classed("neon-highlight", true)
      .classed("neon-highlight-fill", true);
    
    const connectedPriceIndices = new Set();
    const connectedRankIndices = new Set();
    
    brandToPriceLinks.forEach((link, i) => {
      if (link.brand === brandName) {
        connectedPriceIndices.add(link.target - brands.length);
        sankeySvg.selectAll(".brandToPriceLink")
          .filter((d, j) => j === i)
          .classed("neon-highlight", true);
      }
    });

    sankeySvg.selectAll(".priceRect")
      .filter((d, i) => connectedPriceIndices.has(i))
      .classed("neon-highlight", true)
      .classed("neon-highlight-fill", true);
    
    priceToRankLinks.forEach((link, i) => {
      if (connectedPriceIndices.has(link.source - brands.length)) {
        connectedRankIndices.add(link.target - brands.length - priceRanges.length);
        sankeySvg.selectAll(".priceToRankLink")
          .filter((d, j) => j === i)
          .classed("neon-highlight", true);
      }
    });
    
    sankeySvg.selectAll(".rankRect")
      .filter((d, i) => connectedRankIndices.has(i))
      .classed("neon-highlight", true)
      .classed("neon-highlight-fill", true);
    ["brandRect", "priceRect", "rankRect", "brandToPriceLink", "priceToRankLink"].forEach(selector => {
      sankeySvg.selectAll(`.${selector}`)
        .filter(function(d) {
          if (selector === "brandRect") return d !== brandName;
          if (selector === "priceRect") return !connectedPriceIndices.has(d.index);
          if (selector === "rankRect") return !connectedRankIndices.has(d.index);
          if (selector === "brandToPriceLink") return d.brand !== brandName;
          return !connectedPriceIndices.has(d.source - brands.length);
        })
        .classed("faded", true);
    });
  }

  // Clear highlights when clicking outside 
  sankeySvg.on("click", function(event) {
    if (!event.target.closest(".brandRect")) {
      sankeySvg.selectAll(".neon-highlight, .neon-highlight-fill, .faded")
        .classed("neon-highlight", false)
        .classed("neon-highlight-fill", false)
        .classed("faded", false)
        .attr("opacity", 1);
    }
  });
}

function setupFilter() {
  // Create filter dropdown
  const uniqueLabels = ["All", ...new Set(rawData.map(d => d.Label))].filter(Boolean);
  const labelFilter = d3.select("#labelFilter");

  // Add options
  labelFilter.selectAll("option")
    .data(uniqueLabels)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  labelFilter.on("change", function() {
    const selectedLabel = this.value;
    const filteredData = selectedLabel === "All" ? rawData : rawData.filter(d => d.Label === selectedLabel);
    drawBarChart(filteredData);
    drawIngredientTreemap(filteredData);
    drawSankey(filteredData);
  });
}

// Window resize handler- can work on different window sizes:)
let resizeTimer;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
    if (rawData.length > 0) {
      const selectedLabel = document.getElementById('labelFilter').value;
      const filteredData = selectedLabel === "All" ? rawData : rawData.filter(d => d.Label === selectedLabel);
      drawBarChart(filteredData);
      drawIngredientTreemap(filteredData);
    }
  }, 200);
});