let rawData = [];
let lastSankeyWidth = 0;

document.addEventListener('DOMContentLoaded', function() {
    d3.csv("cosmetics.csv").then(function(data) {
        rawData = data;
        drawBarChart(data);
        drawIngredientTreemap(data);
        
        // Set initial Sankey width
        const container = d3.select("#sankey-chart");
        lastSankeyWidth = container.node().getBoundingClientRect().width;
        drawSankey(data);
        
        setupFilter(data);
    })
});

function setupFilter(data) {
    // Get unique labels from data like moisturizer, cleanser, and so on
    const uniqueLabels = ["All", ...new Set(data.map(d => d.Label))].filter(Boolean);
    const labelFilter = d3.select("#labelFilter");
    labelFilter.selectAll("option").remove();

    // To select Moisturizer as the default option for the filter instead of All but All is still included in the options.
    labelFilter.selectAll("option")
        .data(uniqueLabels)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d)
        .property("selected", d => d === "Moisturizer"); // Set Moisturizer as default
    labelFilter.property("value", 
        uniqueLabels.includes("Moisturizer") ? "Moisturizer" : "All"
    );
    const initialFilter = uniqueLabels.includes("Moisturizer") ? "Moisturizer" : "All";
    const filteredData = initialFilter === "All" ? rawData : rawData.filter(d => d.Label === initialFilter);
    drawBarChart(filteredData);
    drawIngredientTreemap(filteredData);
    drawSankey(filteredData);

    labelFilter.on("change", function() {
        const selectedLabel = this.value;
        const filteredData = selectedLabel === "All" ? rawData : rawData.filter(d => d.Label === selectedLabel);
        drawBarChart(filteredData);
        drawIngredientTreemap(filteredData);
        drawSankey(filteredData);
    });
}

function drawBarChart(data) {
    const margin = {top: 60, right: 20, bottom: 100, left: 60};
    // Select the container div 
    const container = d3.select("#bar-chart");
    container.html("");
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    // Using d3.descending for sorting
    const brands = Array.from(new Set(data.map(d => d.Brand)))
        .filter(Boolean)
        .sort((a, b) => d3.descending(
            data.filter(d => d.Brand === a).length,
            data.filter(d => d.Brand === b).length
        ))
        .slice(0, 10);
    const skinTypes = ["Combination", "Dry", "Normal", "Oily", "Sensitive"]; 
    
    // Create color scale for skin types
    const colorScale = d3.scaleOrdinal()
        .domain(skinTypes)
        .range(["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f"]);

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

    // Create a tooltip div
    const tooltip = d3.select("body").append("div")
        .attr("class", "bar-chart-tooltip tooltip")
        .style("opacity", 0);

    // D3 SCALES:
    const x0 = d3.scaleBand()
        .domain(brands)
        .range([0, width])
        .padding(0.2);

    // x1 - scale for skin types 
    const x1 = d3.scaleBand()
        .domain(skinTypes)
        .range([0, x0.bandwidth()])
        .padding(0.1);

    // y -  scale for counts
    const y = d3.scaleLinear()
        .domain([0, d3.max(brandData, d => d3.max(d.counts, c => c.count))])
        .nice()
        .range([height, 0]);

    // Create SVG container
    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
        .attr("preserveAspectRatio", "xMinYMin meet");
    const chartGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create legend using data binding
    svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${margin.left + width/2 - (skinTypes.length * 50)/2}, ${margin.top - 30})`)
        .selectAll("g")
        .data(skinTypes)
        .enter().append("g")
        .attr("transform", (d,i) => `translate(${i * 90}, 0)`)
        .each(function(skinType) {
            // D3 ELEMENT CREATION: Add colored rectangles for legend
            d3.select(this).append("rect")
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", colorScale(skinType));
            
            // D3 ELEMENT CREATION: Add text labels for legend
            d3.select(this).append("text")
                .attr("x", 15)
                .attr("y", 10)
                .text(skinType)
                .style("font-size", "10px");
        });

    // Create groups for each brand
    const brandGroups = chartGroup.selectAll(".brand-group")
        .data(brandData)
        .enter().append("g")
        .attr("class", "brand-group")
        .attr("transform", d => `translate(${x0(d.brand)},0)`);

    //Create bars within each group
    const bars = brandGroups.selectAll(".bar")
        .data(d => d.counts)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x1(d.skinType))
        .attr("y", d => y(d.count))
        .attr("width", x1.bandwidth())
        .attr("height", d => height - y(d.count))
        .attr("fill", d => colorScale(d.skinType))
        // Using d3 for Mouseover interaction
        .on("mouseover", function(event, d) {
            if (!d3.select(this).classed("bar-active")) {
                d3.select(this).attr("opacity", 0.7);
            }
            tooltip.html(`<strong>${d.skinType} Skin</strong><br/>Total: <strong>${d.count}</strong>`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px")
                .style("opacity", 0.9);
        })      
        // Using d3 for Mouseover interaction
        .on("mouseout", function() {
            if (!d3.select(this).classed("bar-active")) {
                d3.select(this).attr("opacity", 1);
            }
            tooltip.style("opacity", 0);
        })
        // Using d3 for Mouseover interaction
        .on("click", function(event, d) {
            const brand = d3.select(this.parentNode).datum().brand;
            const skinType = d.skinType;
            
            const filteredData = rawData.filter(product => 
                product.Brand === brand && 
                (product[skinType] === "1" || product[skinType] === 1)
            );
            
            const title = `By ${brand} for ${skinType} Skin`;
            drawIngredientTreemap(filteredData, title);

            // Using d3 for highlightinf
            d3.selectAll(".bar")
                .classed("bar-inactive", true)
                .classed("bar-active", false);
                
            d3.select(this)
                .classed("bar-active", true)
                .classed("bar-inactive", false);
        });

    // Create x-axis
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(${margin.left},${margin.top + height})`)
        .call(d3.axisBottom(x0))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    // Create y-axis
    svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .call(d3.axisLeft(y));
}
function drawIngredientTreemap(data, customTitle) {
    // Select container
    const container = d3.select("#ingredients-treemap");
    container.html("");
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const width = containerWidth * 0.95;
    const height = containerHeight - 120;
    const title = customTitle;
    
    // Count ingredient frequency
    const ingredientCounts = {};
    data.forEach(d => {
        const ingredients = d.Ingredients ? d.Ingredients.split(",").map(s => s.trim()) : [];
        new Set(ingredients).forEach(ing => {
            if (ing) ingredientCounts[ing] = (ingredientCounts[ing] || 0) + 1;
        });
    });

    // Keep top 25
    const topIngredients = Object.entries(ingredientCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([name, count]) => ({ name, value: count }));

    // Create hierarchy for treemap
    const root = d3.hierarchy({ children: topIngredients }).sum(d => d.value);
    d3.treemap()
        .size([width, height])
        .padding(3)(root);

    // Create color scale
    const maxValue = d3.max(topIngredients, d => d.value);
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, maxValue]);

    // Create SVG container
    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
        .attr("preserveAspectRatio", "xMinYMin meet");

    // title
    svg.append("text")
        .attr("class", "treemap-title")
        .attr("x", 20)
        .attr("y", 30)
        .attr("text-anchor", "start")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(title);

    // Extra instructions under Title
    svg.append("text")
        .attr("x", 0)
        .attr("y", 10)
        .attr("text-anchor", "start")
        .style("font-size", "14px")
        .style("fill", "red")
        .text("\* Click and drag to highlight specific ingredient groups in the treemap.");

    const treemapGroup = svg.append("g")
        .attr("transform", `translate(0, 50)`);

    // Create groups for each treemap cell
    const cells = treemapGroup.selectAll("g")
        .data(root.leaves())
        .enter()
        .append("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`)
        .attr("class", "treemap-cell");

    // Create treemap rectangles
    cells.append("rect")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => color(d.data.value));
    cells.each(function(d) {
        const cell = d3.select(this);
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;  
        if (width > 40 && height > 20) {
            const fo = cell.append("foreignObject")
                .attr("width", width - 8)
                .attr("height", height - 8)
                .attr("x", 4)
                .attr("y", 4);
            fo.append("xhtml:div")
                .style("font-size", "10px")
                .style("font-weight", "bold")
                .style("color", "#265828")
                .style("width", "100%")
                .style("height", "100%")
                .style("overflow", "hidden")
                .style("display", "flex")
                .style("align-items", "center")
                .style("word-break", "break-word")
                .style("padding", "2px")
                .text(d.data.name);
        }});

    const defs = svg.append("defs");
    defs.append("filter")
        .attr("id", "drop-shadow")
        .append("feDropShadow")
        .attr("dx", 0)
        .attr("dy", 0)
        .attr("stdDeviation", 3)
        .attr("flood-color", "#333");

    // Blur unselected rects
    defs.append("filter")
        .attr("id", "blur-filter")
        .append("feGaussianBlur")
        .attr("stdDeviation", 2);

    // D3 brushing
    let selectedIngredients = [];
    const brush = d3.brush()
        .extent([[0, 50], [width, height + 50]])
        .on("end", ({selection}) => {
            selectedIngredients = [];
            if (selection) {
                const [[x0, y0], [x1, y1]] = selection;
                cells.select("rect")
                    .attr("opacity", 1)
                    .attr("stroke", null)
                    .attr("stroke-width", null)
                    .attr("filter", null);
                cells.each(function(d) {
                    const cellX = d.x0;
                    const cellY = d.y0;
                    const cellWidth = d.x1 - d.x0;
                    const cellHeight = d.y1 - d.y0;
                    if (x0 <= cellX + cellWidth && 
                        x1 >= cellX && 
                        y0 <= cellY + cellHeight && 
                        y1 >= cellY) {
                        selectedIngredients.push(d.data);
                        d3.select(this).select("rect")
                            .attr("stroke", "#333")
                            .attr("stroke-width", 3)
                            .attr("filter", "url(#drop-shadow)");
                    } });
                // Blur unselected cells
                cells.select("rect")
                    .filter(function(d) {
                        return !selectedIngredients.includes(d.data);
                    })
                    .attr("opacity", 0.3)
                    .attr("filter", "url(#blur-filter)");
            } else {
                    cells.select("rect")
                    .attr("opacity", 1)
                    .attr("stroke", null)
                    .attr("stroke-width", null)
                    .attr("filter", null);
            } });
    svg.append("g")
        .attr("class", "brush")
        .call(brush)
        .selectAll(".selection")  
        .attr("stroke", "none")  
        .attr("fill", "none");

    //Color legend
    const legendHeight = 20;
    const legendPaddingLeft = 20;
    const legendMargin = { top: height + 80, left: 20 };
    const legendWidth = containerWidth;
    const gradient = defs.append("linearGradient")
        .attr("id", "treemap-gradient")
        .attr("x1", "0%")
        .attr("x2", "100%");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", d3.interpolateBlues(0));
    gradient.append("stop").attr("offset", "100%").attr("stop-color", d3.interpolateBlues(1));
    svg.append("rect")
        .attr("x", legendPaddingLeft) 
        .attr("y", legendMargin.top)
        .attr("width", width - legendPaddingLeft)
        .attr("height", legendHeight)
        .style("fill", "url(#treemap-gradient)");

    // Create scale for legend axis
    const legendScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, legendWidth]);

    // Position of legend axis
    const legendAxis = svg.append("g")
        .attr("transform", `translate(${legendPaddingLeft},${legendMargin.top + legendHeight})`)
        .call(d3.axisBottom(legendScale).ticks(5));
    legendAxis.select(".domain").remove();
    legendAxis.selectAll("text")
        .style("font-size", "10px")
        .style("font-family", "sans-serif");
        
    // title
    svg.append("text")
        .attr("x", 0)
        .attr("y", legendMargin.top - 5)
        .attr("text-anchor", "start")
        .style("font-size", "11px")
        .style("font-weight", "bold")
        .text("Ingredient Frequency (low to high)");
}
function drawSankey(data) {
    // Select container and get dimensions
    const container = d3.select("#sankey-chart");
    container.html("");
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const svgWidth = Math.min(1200, containerWidth);
    let svgHeight = Math.min(1000, containerHeight)
    const nodeHeight = 20;
    const nodeSpacing = 30;
    const rightColumnX = svgWidth * 0.45;
    const rightColumnYOffset = 150;
    const rightNodeSpacing = 150; 
    const rankColumnX = svgWidth * 0.75;
    const rankColumnYOffset = 150;
    const rankNodeSpacing = 150;
    const nodeWidth = 100;
    const fontSize = "10px";
    const topMargin = 50;

    // color scale for links
    const linkColorScale = d3.scaleOrdinal()
        .domain(["Low (0-3)", "Medium (3-4)", "High (4-5)"])
        .range(["#492000", "#51DBFF", "#F2698B"]);

    // Create tooltip 
    const tooltip = d3.select("body").append("div")
        .attr("class", "sankey-tooltip tooltip")
        .style("opacity", 0);

    // Create SVG container 
    const sankeySvg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
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

    const brands = Array.from(new Set(data.map(d => d.Brand))).filter(Boolean).sort();
    let brandToPriceLinks = [];
    let priceToRankLinks = [];
    svgHeight = topMargin + (brands.length * (nodeHeight + nodeSpacing)) + 300;
    sankeySvg.attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

    function getPriceRangeIndex(price) {
        const num = +price;
        return priceRanges.findIndex(r => num >= r.min && num < r.max);
    }
    function getRankIndex(rank) {
        const num = +rank;
        return rankCategories.findIndex(r => num >= r.min && num < r.max);
    }

    // links from brands to price ranges
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
            brand: brands[brandIndex],
            sourceIndex: brandIndex,
            targetIndex: priceRangeIndex
        });
    }

    // links from price ranges to rank categories 
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
            rankName: rankCategories[rankIndex].name,
            sourceIndex: priceRangeIndex,
            targetIndex: rankIndex
        });
    }
    brandToPriceLinks.sort((a, b) => b.value - a.value);
    priceToRankLinks.sort((a, b) => b.value - a.value);

    // Draw brand nodes 
    sankeySvg.selectAll(".brandRect")
        .data(brands)
        .enter()
        .append("rect")
        .attr("class", "brandRect")
        .attr("x", 20)
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
    const rankColors = {
    "Low (0-3)": "#492000",
    "Medium (3-4)": "#51DBFF", 
    "High (4-5)": "#F2698B"
};
    sankeySvg.selectAll(".rankRect")
        .data(rankNames)
        .enter()
        .append("rect")
        .attr("class", "rankRect")
        .attr("x", rankColumnX)
        .attr("y", (d, i) => rankColumnYOffset + i * (nodeHeight + rankNodeSpacing))
        .attr("width", nodeWidth)
        .attr("height", nodeHeight)
        .style("fill", d => rankColors[d]);

    // create properly spaced curved paths with no overlaps
    function createNonOverlappingPath(sourceX, sourceY, targetX, targetY, index, total, linkHeight) {
        const controlX1 = sourceX + (targetX - sourceX) * 0.4;
        const controlX2 = sourceX + (targetX - sourceX) * 0.6;
        const offsetRange = Math.min(nodeHeight * 0.8, 20); // Limit maximum offset
        const offset = (index - (total - 1) / 2) * (offsetRange / Math.max(1, total - 1));
        const path = d3.path();
        path.moveTo(sourceX, sourceY);
        path.bezierCurveTo(
            controlX1, sourceY + offset,
            controlX2, targetY + offset,
            targetX, targetY
        );
        return path.toString();
    }
    const groupLinks = (links) => {
        const groups = {};
        links.forEach(link => {
            const key = `${link.source}-${link.target}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(link);
        });
        return groups;
    };

    // Draw brand to price links
    const brandPriceGroups = groupLinks(brandToPriceLinks);
    Object.values(brandPriceGroups).forEach(group => {
        group.forEach((link, i) => {
            const sourceX = 20 + nodeWidth;
            const sourceY = topMargin + link.source * (nodeHeight + nodeSpacing) + nodeHeight / 2;
            const targetX = rightColumnX;
            const targetY = rightColumnYOffset + link.targetIndex * (nodeHeight + rightNodeSpacing) + nodeHeight / 2;
            
            const path = createNonOverlappingPath(
                sourceX, sourceY, 
                targetX, targetY, 
                i, group.length, 
                Math.max(1, Math.sqrt(link.value))
            );
            
            sankeySvg.append("path")
                .attr("class", "brandToPriceLink")
                .attr("d", path)
                .attr("stroke", "#888")
                .attr("stroke-width", Math.max(1, Math.sqrt(link.value)))
                .attr("fill", "none")
                .attr("stroke-opacity", 0.7)
                .attr("data-brand", link.brand)
                .attr("data-source-index", link.source)
                .attr("data-target-index", link.targetIndex);
        });
    });
    // Draw price to rank links
    const priceRankGroups = groupLinks(priceToRankLinks);
    Object.values(priceRankGroups).forEach(group => {
        group.forEach((link, i) => {
            const sourceX = rightColumnX + nodeWidth;
            const sourceY = rightColumnYOffset + link.sourceIndex * (nodeHeight + rightNodeSpacing) + nodeHeight / 2;
            const targetX = rankColumnX;
            const targetY = rankColumnYOffset + link.targetIndex * (nodeHeight + rankNodeSpacing) + nodeHeight / 2;
            
            const path = createNonOverlappingPath(
                sourceX, sourceY, 
                targetX, targetY, 
                i, group.length, 
                Math.max(1, Math.sqrt(link.value))
            );
            sankeySvg.append("path")
                .attr("class", "priceToRankLink")
                .attr("d", path)
                .attr("stroke", linkColorScale(link.rankName))
                .attr("stroke-width", Math.max(1, Math.sqrt(link.value)))
                .attr("fill", "none")
                .attr("stroke-opacity", 0.7)
                .attr("data-rank", link.rankName)
                .attr("data-source-index", link.source)
                .attr("data-target-index", link.targetIndex);
        });
    });

    // draw labels 
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

    // labels for all columns 
    drawLabels(".brandText", brands, 25, topMargin, nodeSpacing);
    drawLabels(".priceText", priceRangeNames, rightColumnX, rightColumnYOffset, rightNodeSpacing);
    drawLabels(".rankText", rankNames, rankColumnX, rankColumnYOffset, rankNodeSpacing);

    // column titles 
    sankeySvg.append("text")
        .attr("x", 20 + nodeWidth / 2)
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

    sankeySvg.append("text")
        .attr("x", 0)
        .attr("y", 10)
        .attr("text-anchor", "start")
        .style("font-size", "14px")
        .style("fill", "red")
        .text("\* Click on any brand(sorted) to highlight its price range and customer rating relationships.");

    // Highlight connections
    function highlightConnections(brandName) {
        sankeySvg.selectAll(".neon-highlight, .neon-highlight-fill, .faded")
            .classed("neon-highlight", false)
            .classed("neon-highlight-fill", false)
            .classed("faded", false)
            .attr("opacity", 1);
        
        // Highlight selected brand
        sankeySvg.selectAll(".brandRect")
            .filter(d => d === brandName)
            .classed("neon-highlight", true)
            .classed("neon-highlight-fill", true);
        
        const connectedPriceIndices = new Set();
        const connectedRankIndices = new Set();
        sankeySvg.selectAll(".brandToPriceLink")
            .filter(function() {
                return d3.select(this).attr("data-brand") === brandName;
            })
            .classed("neon-highlight", true)
            .each(function() {
                connectedPriceIndices.add(+d3.select(this).attr("data-target-index"));
            });

        // Highlight connected price nodes
        sankeySvg.selectAll(".priceRect")
            .filter((d, i) => connectedPriceIndices.has(i))
            .classed("neon-highlight", true)
            .classed("neon-highlight-fill", true);
        // Highlight price-to-rank links
        sankeySvg.selectAll(".priceToRankLink")
            .filter(function() {
                const sourceIndex = +d3.select(this).attr("data-source-index") - brands.length;
                return connectedPriceIndices.has(sourceIndex);
            })
            .classed("neon-highlight", true)
            .each(function() {
                connectedRankIndices.add(+d3.select(this).attr("data-target-index"));
            });
        // Highlight connected rank nodes
        sankeySvg.selectAll(".rankRect")
            .filter((d, i) => connectedRankIndices.has(i))
            .classed("neon-highlight", true)
            .classed("neon-highlight-fill", true);
        sankeySvg.selectAll(".brandRect:not(.neon-highlight), " +
                         ".priceRect:not(.neon-highlight), " +
                         ".rankRect:not(.neon-highlight), " +
                         ".brandToPriceLink:not(.neon-highlight), " +
                         ".priceToRankLink:not(.neon-highlight)")
            .classed("faded", true);
    }
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
//resize dashboard based on the screen size
let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        if (rawData.length > 0) {
            const selectedLabel = document.getElementById('labelFilter').value;
            const filteredData = selectedLabel === "All" ? rawData : rawData.filter(d => d.Label === selectedLabel);
            drawBarChart(filteredData);
            drawIngredientTreemap(filteredData);
            const container = d3.select("#sankey-chart");
            const newWidth = container.node().getBoundingClientRect().width;
            if (Math.abs(newWidth - lastSankeyWidth) > 50) {
                drawSankey(filteredData);
                lastSankeyWidth = newWidth;
            }
        }
    }, 200);
});


//AI use
// I used it to help me with creating skin types bars grouped together for each brand
// How when i click on a bar will change my tree map result based on the selected bar
// Few ideas for tree map and also how to divide text into lines because my ingrident names were too long to fit in a single line.
// I took most help for the sankey visual like creating categories, creating rects, adding lines, and specially highlighting.
// I also learned how when I click somewhere else, highlighted part should be unlighted and no bluring for the rest.
// Also, for the drop down filter, I took help to set moisturizer as default slection not All but All is still included in the options.
// Lastly, resize function so my visual fits in different display sizes.