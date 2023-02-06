// create mapbox code
var map = new maplibregl.Map({
    container: 'map',
    style: 'https://api.maptiler.com/maps/basic-v2-light/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
    center: [-122.206638,37.605751], 
    zoom: 9,
    // pitch: 45
  });

map.addControl(new maplibregl.NavigationControl(), 'bottom-left');
// map.addControl(new maplibregl.ScaleControl({position: 'bottom-right'}));

map.on("viewreset", render);
map.on("move", render);
map.on("moveend", render);

function rotateCamera(timestamp) {
    // clamp the rotation between 0 -360 degrees
    // Divide timestamp by 100 to slow rotation to ~10 degrees / sec
    map.rotateTo((timestamp / 800) % 360, { duration: 10 });
    // Request the next frame of the animation.
    requestAnimationFrame(rotateCamera);
}
// rotateCamera(0);
     
d3.selectAll(".mapboxgl-canvas")
    .style("opacity", 1)
    .style("position", "absolute")
    .style("z-index", 1);

// utility functions to convert between pixel and lat/lng coordinates
function project(d) {
    return map.project(new maplibregl.LngLat(d.coordinates[1], d.coordinates[0]));
}
function project_alt(x,y) {
    return map.project(new maplibregl.LngLat(x, y));
}
function unproject(x,y) {
    return map.unproject([x,y]);
}

function render() {
    dots
        .attr("cx", function (d) {
        return project(d).x;
        })
        .attr("cy", function (d) {
        return project(d).y;
        })
        .attr("r", Math.max(map.getZoom()**2/25, 3));
    
    // data_circle = circle()
    // data_circle['coordinates'][0] = data_circle['coordinates'][0].map(d => [project_alt(d[0], d[1]).x, project_alt(d[0], d[1]).y])
    zones.forEach(zone =>
        zone.attr("d", d3.geoPath()(generate_circle(zone.property("lng"), zone.property("lat"), zone.property("dist"))))
    )
    update_centers()
}

function update_centers() {
    centers.forEach((center, i) => {
        coords = project_alt(zones[i].property("lng"), zones[i].property("lat"))
        center.attr("d", d3.symbol().type(d3.symbolCross).size(Math.max(map.getZoom()**2/25, 3) * 10))
            .attr("transform", "translate(" + coords.x + "," + coords.y + ")")
    })
}

var container = map.getCanvasContainer();

var svg = d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .style("position", "absolute")
    .style("z-index", 2);

var data, dots, categories, zones
d3.dsv(",", "asst3_yelp.csv", function(d){
    return {
        alias: d.alias,
        name: d.name,
        coordinates: d.coordinates.split(",").map(Number),
        image_url: d.image_url, 
        url: d.url, 
        review_count: +d.review_count, 
        categories: d.categories.split(","), 
        rating: +d.rating,
        price: d.price.length, 
        phone: d.phone, 
        address: eval(d.address)
    }
}).then(function(output_data){
    data = output_data
    console.log(data)
    categories = [...new Set (data.map(i => i.categories).flat(1))]
    console.log(categories)

    // populate unique categories
    d3.select("#select-category")
        .selectAll("option")
        .data(categories)
        .enter()
        .append("option")
        .text(function(d) {return d;})
        .attr("value", function(d) {return d;})

    bottom_layer = svg
        .append("g")
        .attr("id", "bottom_layer")
    
    tip = d3.tip().attr("class", "tooltip").html((event, d) => d);
    tip.direction("e")
    tip.offset([-10, 10])
    generate_tooltip = (event, d) => {
        tip.show(event, `
        <div class="img-wrapper">
            ${d.image_url ?'<img src="' + d.image_url + '"/>':""}
        </div>
        <div class="text-elements">
            <p class="text-main">${d.name}</p>
            <p class="text-content">
                <em>Rating</em>: ${d.rating} <i class="fa-solid fa-star"></i> (${d.review_count}) <em style="margin-left: 0.25rem;">Price</em>: ${"$".repeat(d.price) || "No Data"}
            </p>
        </div>
        `)
    }

    svg.call(tip);

    // populate shop circles
    dots = svg
        .selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("r", Math.max(map.getZoom()**2/25, 3))
        .attr("class", d => d.alias + " circle-shop")
        .on("mouseover", function(event, d){
            generate_tooltip(event, d)
            d3.select(this).attr("selected", "")
        })
        .on("mouseout", function(event, d){
            tip.hide(d)
            if (!d['pinned']) {
                d3.select(this).attr("selected", null)
            }
        })
        .on("click", function(event, d){
            if (d['pinned']) {
                d['pinned'] = false
                d3.select(this).attr("selected", null)
            }else{
                d['pinned'] = true
                d3.select(this).attr("selected", "")
                console.log(d['pinned'])
            }
        })

    focus_data = data.slice(0,30)

    // drag utility function for zone circles
    drag_utility = d3.drag()
        .on("drag", function(event, d){
            pixels = project_alt(d3.select(this).property("lng"), d3.select(this).property("lat"))
            coords = unproject(pixels.x + event.dx, pixels.y + event.dy)
            d3.select(this)
                .style("cursor", "grabbing")
                .property("lng", coords.lng)
                .property("lat", coords.lat)
                .attr("d", d3.geoPath()(generate_circle(coords.lng, coords.lat, d3.select(this).property("dist"))))
            update_centers();
            update_intersection();
        })
        .on("end", function(){
            d3.select(this).style("cursor", "grab")
        })

    // insert zone circles
    zone_1 = bottom_layer.insert("path")
        .property("lng", -122.228367)
        .property("lat", 37.396361)
        .property("dist", 15000)
        .attr("d", d3.geoPath()(generate_circle(-122.228367,37.396361,15000)))
        .classed("zones", true)
        .call(drag_utility)
    
    center_1 = bottom_layer.append("path")
        .attr("d", d3.symbol().type(d3.symbolCross).size(Math.max(map.getZoom()**2/25, 3) * 10))
        .attr("transform", function(){
            coords = project_alt(zone_1.property("lng"), zone_1.property("lat"));
            return `translate(${coords.x}, ${coords.y})`;
        })
        .attr("fill", "steelblue")
        .style("opacity", 0.7)

    zone_2 = bottom_layer.insert("path")
        .property("lng", -122)
        .property("lat", 37.5)
        .property("dist", 15000)
        .attr("d", d3.geoPath()(generate_circle(-122,37.5,15000)))
        .classed("zones", true)
        .call(drag_utility)

    center_2 = bottom_layer.append("path")
        .attr("d", d3.symbol().type(d3.symbolCross).size(Math.max(map.getZoom()**2/25, 3) * 10))
        .attr("transform", function(){
            coords = project_alt(zone_2.property("lng"), zone_2.property("lat"));
            return `translate(${coords.x}, ${coords.y})`;
        })
        .attr("fill", "steelblue")
        .style("opacity", 0.7)

    // event listeners for zone updates
    d3.select("#zone_1_range")
        .on('change', function(){
            update = d3.select(this).property("value") || 15000;
            zone_1.attr("d", d3.geoPath()(generate_circle(zone_1.property("lng"), zone_1.property("lat"), update)))
                .property("dist", update)
            update_intersection();
        })

    d3.select("#zone_2_range")
        .on('change', function(){
            update = d3.select(this).property("value") || 15000;
            zone_2.attr("d", d3.geoPath()(generate_circle(zone_2.property("lng"), zone_2.property("lat"), update)))
                .property("dist", update)
            update_intersection();
        })

    zones = [zone_1, zone_2]
    centers = [center_1, center_2]

    update_intersection();
    render();
})

// generate dist circle around lng, lat coordinate in pixels, dist is in meters
function generate_circle(lng, lat, dist) {
    angle = dist / (6371000 * Math.PI * 2) * 360;
    circle = d3.geoCircle().center([lng, lat]).radius(angle)
    data_circle = circle()
    data_circle['coordinates'][0] = data_circle['coordinates'][0].map(function(d){
        result = project_alt(d[0], d[1])
        return [result.x, result.y]
    })
    return data_circle
}

function coord_distance(lat1, lon1, lat2, lon2) {
    var R = 6371000; // Radius of the earth in km
    var dLat = (lat2-lat1) * (Math.PI/180);  // deg2rad below
    var dLon = (lon2-lon1) * (Math.PI/180); 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; // Distance in m
}

function offset_coord(lat, lon, dist){
    var R = 6371000;
    var m = (1 / ((2 * Math.PI/360) * R / 1000)) / 1000;
    return [lat + (dist * m), lon + (dist * m) / Math.cos(lat * (Math.PI/180))]
}

// find shops in the intersection of two zones
function update_intersection() {
    // check if circles intersect at all
    center_dist = coord_distance(zone_1.property("lat"), zone_1.property("lng"), zone_2.property("lat"), zone_2.property("lng"))
    center_radii = zone_1.property("dist") + zone_2.property("dist")
    if (center_dist > center_radii) {
        dots.attr("highlighted", null)
        d3.select("#shop-results")
            .selectAll("div")
            .remove()
        return undefined;
    }

    // get optimistic top left and bottom right bounds of shops within smallest circle
    zone_small = zone_1.property("dist") > zone_2.property("dist") ? zone_2 : zone_1
    bounds = [
        offset_coord(zone_small.property("lat"), zone_small.property("lng"), zone_small.property("dist")),
        offset_coord(zone_small.property("lat"), zone_small.property("lng"), -zone_small.property("dist"))
    ]

    // if point in bounds, check it is within radius of both circles
    // simutaneously apply styling to highlighted circles to compact loops
    highlighted_data = []
    dots.attr("highlighted", null)
    console.time("find shops")

    dots.filter(d => {
            if (bounds[1][0] <= d.coordinates[0] && d.coordinates[0] <= bounds[0][0] && 
                bounds[1][1] <= d.coordinates[1] && d.coordinates[1] <= bounds[0][1]){
                    dist_1 = coord_distance(d.coordinates[0], d.coordinates[1], zone_1.property("lat"), zone_1.property("lng"))
                    if (dist_1 <= zone_1.property("dist")){
                        dist_2 = coord_distance(d.coordinates[0], d.coordinates[1], zone_2.property("lat"), zone_2.property("lng"))
                        if (dist_2 <= zone_2.property("dist")){
                            highlighted_data.push(d)
                            return true;
                        }
                    }
            }
            return false
        })
        .attr("highlighted", "")

    
    highlighted_data.sort((a,b) => {
            a_score = (4 * 20 + a.rating * a.review_count) / (20 + a.review_count)
            b_score = (4 * 20 + b.rating * b.review_count) / (20 + b.review_count)
            return b_score - a_score
        })
    // console.log(highlighted_data)

    console.timeEnd("find shops")

    d3.select("#shop-results")
        .selectAll("div")
        .remove()

    // populate sidebar results
    d3.select("#shop-results")
        .selectAll("div")
        .data(highlighted_data.slice(0,20))
        .enter()
        .append("div")
        .attr("class", "shop-result")
        .html(d => `
        <div class="img-wrapper">
            ${d.image_url ?'<img src="' + d.image_url + '"/>':""}
        </div>
        <div class="text-elements">
            <p class="text-main">${d.name}</p>
            <p class="text-content">
                <em>Rating</em>: ${d.rating} <i class="fa-solid fa-star"></i> (${d.review_count}) <em style="margin-left: 0.5rem;">Price</em>: ${"$".repeat(d.price) || "No Data"}
                <br>${d.address.join(" ")}
                <br><a href="${d.url}">Yelp Review Link</a>
            </p>
        </div>
        `)
        .on("mouseover", function(event, d){
            d3.select("." + d.alias).attr("selected", "")
            d3.select("." + d.alias).raise()
        })
        .on("mouseout", function(event, d){
            if (!d['pinned']) {
                d3.select("." + d.alias).attr("selected", null)
            }
        })

    // console.log(highlighted_data)
}