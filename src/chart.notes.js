var Chart = require("chart.js");
Chart = typeof(Chart) === "function" ? Chart : window.Chart;
var helpers = Chart.helpers;

Chart.Notes = Chart.Notes || {};

// Default options if none are provided
var defaultOptions = Chart.Notes.defaults = {
    backgroundColor: "rgba(0,0,0,0.8)",
    borderColor: "rgba(0,0,0,0.8)",
    fontColor: "#fff", 
    fontStyle: "bold",
    fontSize: 12,
    fontFamily: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
    fontSpacing: 2,
    maxWidth: 180,
    minWidth: 80
};

var Note = function(originElement, text) {
    this.originElement = originElement;
    this.text = text;
    this.size = {width: 120, height: 20};
    this.position = {x: 0, y: 0};
};
Note.prototype = {
    _setFont: function (chartInstance, ctx) {
        var opts = chartInstance.options.notes;
        ctx.font = helpers.fontString(opts.fontSize, opts.fontStyle, opts.fontFamily);
    },
    resize: function (chartInstance, ctx) {
        this._setFont(chartInstance, ctx);
        var measuredSize = ctx.measureText(this.text);
        console.log(measuredSize);
    },
    reposition: function(chartArea) {
        // Do not count gutters
        var originPosition = this.originElement.tooltipPosition(),
            x = originPosition.x - chartArea.left,
            y = originPosition.y - chartArea.top,
            chartWidth = chartArea.right - chartArea.left,
            chartHeight = chartArea.bottom - chartArea.top,
            halfChartWidth = chartWidth/2,
            halfChartHeight = chartHeight/2,
            distance = 8,
            finalPosition;
        /*------------------------
          | Q1       | Q2        |
          ------------------------
          | Q3       | Q4        |
          ------------------------ */
        if (x <= halfChartWidth && y <= halfChartHeight) { // Q1
           finalPosition = {
               x: originPosition.x + distance,
               y: (originPosition.y - this.size.height) - distance
           };
        } else if (x > halfChartWidth && y <= halfChartHeight) { // Q2
            finalPosition = {
               x: (originPosition.x - this.size.width) - distance,
               y: (originPosition.y - this.size.height) - distance
           };
        } else if (x <= halfChartWidth && y > halfChartHeight) { // Q3
            finalPosition = {
               x: originPosition.x + distance,
               y: (originPosition.y - this.size.height) - distance
           };
        } else { // Q4
            finalPosition = {
               x: (originPosition.x - this.size.width) - distance,
               y: (originPosition.y - this.size.height) - distance
           };
        }
        finalPosition.x = Math.max(finalPosition.x, chartArea.left);
        finalPosition.y = Math.max(finalPosition.y, chartArea.top);
        this.position = finalPosition;
    },
    draw: function (chartInstance, ctx) {
        var originPosition = this.originElement.tooltipPosition(),
            opts = chartInstance.options.notes,
            oldDash = ctx.getLineDash(),
            oldFill = ctx.fillStyle;

        ctx.setLineDash([2, 2]);
        ctx.beginPath();
		ctx.moveTo(originPosition.x, originPosition.y);
        ctx.lineTo(this.position.x, this.position.y + this.size.height);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash(oldDash);

        helpers.drawRoundedRectangle(ctx, this.position.x, this.position.y, 
            this.size.width, this.size.height, 3);
        ctx.fill();
        ctx.stroke();
        this._setFont(chartInstance, ctx);
        ctx.fillStyle = opts.fontColor;
        ctx.fillText(this.text, this.position.x + 3, this.position.y + 3);
        ctx.fillStyle = oldFill;
    },
    hit: function(position) {
        var left = this.position.x,
            top = this.position.y,
            right = this.position.x + this.size.width,
            bottom = this.position.y + this.size.height;
        if (left <= position.x &&
            top <= position.y &&
            right >= position.x &&
            bottom >= position.y) {
            return true;
        }
        return false;
    }
};

var NoteList = function() {
    this._notes = [];
    this._positioned = false;
};
NoteList.prototype = {
    addNote: function (note) {
        this._notes.push(note);
    },
    getNote: function (index) {
        return this._notes[index];
    },
    length: function () {
        return this._notes.length;
    },
    resetLayout: function () {
        this._positioned = false;
    },
    updateLayout: function(chartInstance, ctx) {
        if (!this._positioned) {
            for (var i=0, l=this._notes.length; i<l; ++i) {
                var note = this._notes[i];
                note.resize(chartInstance, ctx);
                note.reposition(chartInstance.chartArea);
            }
            this._positioned = true;
        }
    },
    draw: function(chartInstance, ctx) {
        for (var i=0; i<this._notes.length; ++i) {
            this._notes[i].draw(chartInstance, ctx);
        }
    },
    didHitNote: function(position) {
        for (var i=0; i<this._notes.length; ++i) {
            var note = this._notes[i];
            if (note.hit(position)) {
                return note;
            }
        }
        return null;
    }
};
var findNotesPlugin = function () {
    // Fish out refence to our plugin itself
    // This feels dirty..
    var plugins = Chart.plugins.getAll(); 
    for (var i=0; i<plugins.length; ++i) {
        if (plugins[i] instanceof NotesPlugin) {
            return plugins[i];
        }
    }
    return null;
};

var NotesPlugin = Chart.PluginBase.extend({

    onClick: function(event, active) {
        // !!!! 'this' is pointing to the chart controller.
        var me = findNotesPlugin(),
            hitNote;
        if (me) {
            if (me._noteList) {
                var pos = helpers.getRelativePosition(event, this.chart);
                hitNote = me._noteList.didHitNote(pos);
                if (hitNote) {
                    // TODO
                }
            }
            if (!hitNote && me._chartOptsOnClick) {
                me._chartOptsOnClick.call(this, event, active);
            }
        }
    },
    beforeInit: function(chartInstance) {
        var options = chartInstance.options;
        options.notes = helpers.configMerge(options.notes, Chart.Notes.defaults);
        
        // Chart.JS only support one onClick handler, so save the user configured handler 
        // override it and call it from our own handler instead.
        this._chartOptsOnClick = options.onClick;
        options.onClick = this.onClick;
    },
    afterInit: function(chartInstance) { },
    resize: function(chartInstance, newChartSize) {
        // Unfortunately chartInstance.chartArea is not updated at this point
        // so just reset position and recalculate later
        if (this._noteList) {
            this._noteList.resetLayout();
        }
    },

    beforeUpdate: function(chartInstance) { },
    afterScaleUpdate: function(chartInstance) { },

    beforeDatasetsUpdate: function(chartInstance) { },
    afterDatasetsUpdate: function(chartInstance) {
        this._noteList = new NoteList();
        helpers.each(chartInstance.data.datasets, function(dataset, datasetIndex) {
            var notes = dataset.notes || [];
            for (var i = 0; i < notes.length; ++i) {
                var meta = chartInstance.getDatasetMeta(datasetIndex);
				var originElement = meta.data[notes[i].offset];
                this._noteList.addNote(
                    new Note(originElement, notes[i].text));
            }
        }, this);
    },
    afterUpdate: function(chartInstance) { },

    // This is called at the start of a render. It is only called once, even if the animation will run for a number of frames. Use beforeDraw or afterDraw
    // to do something on each animation frame
    beforeRender: function(chartInstance) { },

    // Easing is for animation
    beforeDraw: function(chartInstance, easing) { },
    afterDraw: function(chartInstance, easing) { },

    // Before the datasets are drawn but after scales are drawn
    beforeDatasetsDraw: function(chartInstance, easing) { },
    afterDatasetsDraw: function(chartInstance, easing) {
        var ctx = chartInstance.chart.ctx,
            notes = chartInstance.data.notes || [],
            opts = chartInstance.options.notes;
        if (easing != this._easing) {
            // Make sure we reset layout when we are done "easing".
            this._noteList.resetLayout();
            this._easing = easing;
        }
        this._noteList.updateLayout(chartInstance, ctx);
        // Canvas setup
        ctx.lineWidth = 1;
        ctx.fillStyle = opts.backgroundColor;
        ctx.strokeStyle = opts.borderColor;

        this._noteList.draw(chartInstance, ctx);
    },

    destroy: function(chartInstance) { }

});
module.exports = NotesPlugin;
Chart.pluginService.register(new NotesPlugin());
