const mathApp = {};

mathApp.BLOCK_TYPES = {
    UNDEFINED:  'undefined',
    TEXT:       'text',
    DATA:       'data',
    INPUT:      'input',
    BUNDLE:     'bundle'
};

mathApp.BUNDLE_TYPES = {
    OPERATOR:   'operator'
};

mathApp.initialize = function () {
    this.topBlocks = [];
    this.selectedBlock = null;

    this.isCtrlKeyPressing = false;
    this.isMouseDragging = false;
    this.prevDraggingPoint = { x: 0, y: 0 };

    this.canvas = new fabric.Canvas('c', {
        backgroundColor: '#eee',
        hoverCursor: 'default',
        selection: false
    });

    this.parser = math.parser();

    $(document).mousedown(function (event) {
        mathApp.handleMouseDown({ x: event.pageX, y: event.pageY });
    });

    $(document).mousemove(function (event) {
        mathApp.handleMouseMove({ x: event.pageX, y: event.pageY });
    });

    $(document).mouseup(function (event) {
        mathApp.handleMouseUp({ x: event.pageX, y: event.pageY });
    });

    $(document).keydown(function (event) {
        mathApp.handleKeyDown(event.key);
    });

    $(document).keypress(function (event) {
        mathApp.handleKeyPress(event.key);
    });

    $(document).keyup(function (event) {
        mathApp.handleKeyUp(event.key);
    });

    this.initBundleBlocks();
};

mathApp.initBundleBlocks = function () {
    new mathApp.OperatorBundle({ x: 75, y: 40 }, '+', '+');
    new mathApp.OperatorBundle({ x: 75, y: 100 }, '-', '-');
    new mathApp.OperatorBundle({ x: 75, y: 160 }, '×', '*');
    new mathApp.OperatorBundle({ x: 75, y: 220 }, '÷', '/');
    new mathApp.OperatorBundle({ x: 75, y: 280 }, '%', '%');
    new mathApp.OperatorBundle({ x: 75, y: 340 }, '^', '^');
};

mathApp.handleMouseDown = function (windowPoint) {
    if (this.isInCanvas(windowPoint)) {
        const canvasPoint = this.transformToCanvasCoords(windowPoint);
        let topBlock = this.findTopBlockOn(canvasPoint);

        if (this.selectedBlock) {
            if (topBlock === this.selectedBlock) {
                topBlock = topBlock.selectBlock(canvasPoint);
            }

            this.selectedBlock.onDeselected();
            this.selectedBlock = null;
        }

        if (topBlock) {
            if (this.isCtrlKeyPressing) {
                topBlock = topBlock.copyBlock();
            }

            this.selectedBlock = topBlock;
            this.selectedBlock.onSelected();
        }

        this.isMouseDragging = true;
        this.prevDraggingPoint = canvasPoint;
        this.canvas.requestRenderAll();
    }
    else {
        this.isMouseDragging = false;
        this.prevDraggingPoint = { x: 0, y: 0 };
    }
};

mathApp.handleMouseMove = function (windowPoint) {
    if (this.isMouseDragging) {
        const canvasPoint = this.transformToCanvasCoords(windowPoint);

        if (this.selectedBlock) {
            this.selectedBlock.translate({
                x: canvasPoint.x - this.prevDraggingPoint.x,
                y: canvasPoint.y - this.prevDraggingPoint.y
            });
        }

        this.prevDraggingPoint = canvasPoint;
        this.canvas.requestRenderAll();
    }
};

mathApp.handleMouseUp = function (windowPoint) {
    if (this.selectedBlock) {
        for (const topBlock of this.topBlocks) {
            if (topBlock === this.selectedBlock || topBlock.type !== mathApp.BLOCK_TYPES.BUNDLE) {
                continue;
            }

            if (!this.checkCollision(this.selectedBlock, topBlock)) {
                continue;
            }

            const inputBlock = topBlock.findInputBlockOn();

            if (!inputBlock) {
                continue;
            }

            inputBlock.pushChildBlock(this.selectedBlock);
            break;
        }

        this.canvas.requestRenderAll();
    }

    if (this.isMouseDragging) {
        this.isMouseDragging = false;
        this.prevDraggingPoint = { x: 0, y: 0 };
    }
};

mathApp.handleKeyDown = function (keyValue) {
    if (keyValue === 'Control') {
        this.isCtrlKeyPressing = true;
    }

    const topBlock = this.selectedBlock;

    if (!topBlock) {
        return;
    }

    switch (keyValue) {
        case 'Delete':
            topBlock.destroy();
            break;

        case 'Enter':
            topBlock.calculate();
            break;

        case 'Backspace':
            if (topBlock.type === mathApp.BLOCK_TYPES.DATA) {
                const data = topBlock.getData();

                if (data.length === 1) {
                    topBlock.destroy();
                }
                else {
                    topBlock.setData(data.slice(0, data.length - 1));
                }
            }

            break;
    }

    this.canvas.requestRenderAll();
};

mathApp.handleKeyPress = function (keyValue) {
    const blacklist = [
        'Enter',
        'Delete'
    ];

    if (blacklist.includes(keyValue)) {
        return;
    }

    const topBlock = this.selectedBlock;

    if (topBlock) {
        if (topBlock.type === mathApp.BLOCK_TYPES.DATA) {
            topBlock.setData(topBlock.getData() + keyValue);
        }
    }
    else {
        const padding = 100;
        const position = {
            x: Math.random() * (this.canvas.width - padding * 2) + padding,
            y: Math.random() * (this.canvas.height - padding * 2) + padding
        };

        this.selectedBlock = new mathApp.Data(position, keyValue);
        this.selectedBlock.onSelected();
    }

    this.canvas.requestRenderAll();
};

mathApp.handleKeyUp = function (keyValue) {
    if (keyValue === 'Control') {
        this.isCtrlKeyPressing = false;
    }
};

mathApp.transformToCanvasCoords = function (windowPoint) {
    const rect = this.canvas.getElement().getBoundingClientRect();
    const canvasPoint = {
        x: windowPoint.x - rect.left,
        y: windowPoint.y - rect.top
    };

    return canvasPoint;
};

mathApp.isInCanvas = function (windowPoint) {
    const rect = this.canvas.getElement().getBoundingClientRect();

    if (windowPoint.x >= rect.left &&
        windowPoint.x <= rect.left + rect.width &&
        windowPoint.y >= rect.top &&
        windowPoint.y <= rect.top + rect.height
    ) {
        return true;
    }
    else {
        return false;
    }
};

mathApp.findTopBlockOn = function (canvasPoint) {
    const x = canvasPoint.x;
    const y = canvasPoint.y;

    for (let i = this.topBlocks.length - 1; i >= 0; i--) {
        const topBlock = this.topBlocks[i];

        if (x >= topBlock.position.x - topBlock.size.width / 2 &&
            x <= topBlock.position.x + topBlock.size.width / 2 &&
            y >= topBlock.position.y - topBlock.size.height / 2 &&
            y <= topBlock.position.y + topBlock.size.height / 2
        ) {
            return topBlock;
        }
    }

    return null;
};

mathApp.checkCollision = function (block1, block2) {
    const minPosition = {
        x: Math.min(block1.position.x - block1.size.width / 2, block2.position.x - block2.size.width / 2),
        y: Math.min(block1.position.y - block1.size.height / 2, block2.position.y - block2.size.height / 2)
    };

    const maxPosition = {
        x: Math.max(block1.position.x + block1.size.width / 2, block2.position.x + block2.size.width / 2),
        y: Math.max(block1.position.y + block1.size.height / 2, block2.position.y + block2.size.height / 2)
    };

    const xAxis = (maxPosition.x - minPosition.x) < (block1.size.width + block2.size.width);
    const yAxis = (maxPosition.y - minPosition.y) < (block1.size.height + block2.size.height);

    return xAxis && yAxis;
};

mathApp.Block = class {
    constructor(position) {
        this.position = position;
        this.size = { width: 0, height: 0 };
        this.type = mathApp.BLOCK_TYPES.UNDEFINED;
        this.isSelectable = false;
        this.visualItems = [];
        this.parentBlock = null;
        this.childBlocks = [];

        mathApp.topBlocks.push(this);
    }

    destroy() {
        if (mathApp.selectedBlock === this) {
            mathApp.selectedBlock = null;
            this.onDeselected();
        }

        if (this.parentBlock) {
            const index = this.parentBlock.childBlocks.indexOf(this);
            index > -1 && this.parentBlock.childBlocks.slice(index, 1);
        }

        for (const childBlock of this.childBlocks) {
            childBlock.destroy();
        }

        for (const visualItem of this.visualItems) {
            mathApp.canvas.remove(visualItem);
        }

        this.parentBlock = null;
        this.childBlocks = [];
        this.visualItems = [];

        const index = mathApp.topBlocks.indexOf(this);
        index > -1 && mathApp.topBlocks.splice(index, 1);
    }

    translate(delta) {
        this.position.x += delta.x;
        this.position.y += delta.y;

        for (const childBlock of this.childBlocks) {
            childBlock.translate(delta);
        }

        for (const visualItem of this.visualItems) {
            visualItem.left += delta.x;
            visualItem.top += delta.y;
        }
    }

    moveTo(targetPoint) {
        this.translate({
            x: targetPoint.x - this.position.x,
            y: targetPoint.y - this.position.y
        });
    }

    pushChildBlock(childBlock) {
        if (mathApp.selectedBlock === childBlock) {
            mathApp.selectedBlock = null;
            childBlock.onDeselected();
        }

        const index = mathApp.topBlocks.indexOf(childBlock);
        index > -1 && mathApp.topBlocks.splice(index, 1);

        childBlock.parentBlock = this;
        this.childBlocks.push(childBlock);
    }

    popChildBlock(childBlock) {
        const index = this.childBlocks.indexOf(childBlock);
        index > -1 && this.childBlocks.splice(index, 1);

        childBlock.parentBlock = null;
        mathApp.topBlocks.push(childBlock);
    }

    updateBlock() {
        if (this.parentBlock) {
            this.parentBlock.updateBlock();
        }
    }

    selectBlock(canvasPoint) {
        const x = canvasPoint.x;
        const y = canvasPoint.y;

        for (const childBlock of this.childBlocks) {
            if (childBlock.isSelectable) {
                if (x >= childBlock.position.x - childBlock.size.width / 2 &&
                    x <= childBlock.position.x + childBlock.size.width / 2 &&
                    y >= childBlock.position.y - childBlock.size.height / 2 &&
                    y <= childBlock.position.y + childBlock.size.height / 2
                ) {
                    this.popChildBlock(childBlock);
                    return childBlock;
                }
            }
            else {
                const resultBlock = childBlock.selectBlock(canvasPoint);

                if (resultBlock) {
                    return resultBlock;
                }
            }
        }

        return this.isSelectable ? this : null;
    }

    copyBlock() {
        let newBlock;

        switch (this.type) {
            case mathApp.BLOCK_TYPES.TEXT:
                newBlock = new mathApp.Text({ ... this.position }, this.label);
                break;

            case mathApp.BLOCK_TYPES.DATA:
                newBlock = new mathApp.Data({ ... this.position }, this.data);
                break;

            case mathApp.BLOCK_TYPES.INPUT:
                newBlock = new mathApp.Input({ ... this.position }, { ... this.size });
                break;

            case mathApp.BLOCK_TYPES.BUNDLE:
                switch (this.bundleType) {
                    case mathApp.BUNDLE_TYPES.OPERATOR:
                        newBlock = new mathApp.OperatorBundle({ ... this.position }, this.display, this.operator);
                        break;
                }

                for (let i = 0; i < this.childBlocks.length; i++) {
                    const childBlock = this.childBlocks[i];

                    if (childBlock.type !== mathApp.BLOCK_TYPES.INPUT) {
                        continue;
                    }

                    newBlock.childBlocks[i].pushChildBlock(childBlock.childBlocks[0].copyBlock());
                }

                break;
        }

        return newBlock;
    }

    calculate() {
        let result;

        try {
            result = mathApp.parser.eval(this.makeEvalCode()).toString();

            if (result.slice(0, 8) === 'function') {
                result = 'function';
            }
        }
        catch (e) {
            if (result !== 'function') {
                result = e.toString();
            }
        }

        this.onDeselected();

        const position = {
            x: this.position.x,
            y: this.position.y + this.size.height + 10
        };

        mathApp.selectedBlock = new mathApp.Data(position, result);
        mathApp.selectedBlock.onSelected();
    }

    makeEvalCode() {
        return '';
    }

    bringToFront() {
        for (const visualItem of this.visualItems) {
            mathApp.canvas.bringToFront(visualItem);
        }

        for (const childBlock of this.childBlocks) {
            childBlock.bringToFront();
        }
    }

    onSelected() {
        const index = mathApp.topBlocks.indexOf(this);

        if (index === -1) {
            console.error('mathApp.Block.onSelected() Error!');
            return;
        }

        mathApp.topBlocks.splice(index, 1);
        mathApp.topBlocks.push(this);

        this.bringToFront();
    }

    onDeselected() {

    }
};

mathApp.Text = class extends mathApp.Block {
    constructor(position, label) {
        super(position);

        this.position = position;
        this.type = mathApp.BLOCK_TYPES.TEXT;
        this.label = label;

        // Text
        const text = new fabric.Text(this.label, {
            left: this.position.x,
            top: this.position.y,
            fontFamily: 'Times New Roman',
            fontSize: 30,
            textAlign: 'left',
            stroke: 'black',
            fill: 'black',
            selectable: false
        });

        const textBound = text.getBoundingRect();

        this.size = {
            width: textBound.width,
            height: textBound.height
        };

        text.set({
            left: this.position.x - this.size.width / 2,
            top: this.position.y - this.size.height / 2
        });

        mathApp.canvas.add(text);
        this.visualItems.push(text);
    }

    getLabel() {
        return this.label;
    }

    setLabel(label) {
        this.label = label;

        this.visualItems[0].set({
            text: this.label
        });

        const textBound = this.visualItems[0].getBoundingRect();
        const dx = textBound.width - this.size.width;
        const dy = textBound.height - this.size.height;

        this.position.x += dx / 2;
        this.position.y += dy / 2;
        this.size.width += dx;
        this.size.height += dy;
    }
};

mathApp.Data = class extends mathApp.Block {
    constructor(position, data) {
        super(position);

        this.position = position;
        this.type = mathApp.BLOCK_TYPES.DATA;
        this.isSelectable = true;
        this.data = data;
        this.padding = { x: 10, y: 5 };

        const textBlock = new mathApp.Text({ ... this.position }, this.data);
        this.pushChildBlock(textBlock);

        this.size = {
            width: textBlock.size.width + this.padding.x * 2,
            height: textBlock.size.height + this.padding.y * 2
        };

        // Background
        const background = new fabric.Rect({
            left: this.position.x - this.size.width / 2,
            top: this.position.y - this.size.height / 2,
            width: this.size.width,
            height: this.size.height,
            fill: 'white',
            stroke: 'rgba(0, 0, 0, 0)',
            rx: 6,
            ry: 6,
            selectable: false
        });

        // Boundary
        const boundary = new fabric.Rect({
            left: this.position.x - this.size.width / 2,
            top: this.position.y - this.size.height / 2,
            width: this.size.width,
            height: this.size.height,
            fill: 'rgba(0, 0, 0, 0)',
            stroke: '#95a5a6',
            strokeWidth: 2,
            rx: 6,
            ry: 6,
            selectable: false
        });

        mathApp.canvas.add(background);
        mathApp.canvas.add(boundary);
        this.visualItems.push(background);
        this.visualItems.push(boundary);
    }

    makeEvalCode() {
        return this.getData();
    }

    onSelected() {
        super.onSelected();

        this.visualItems[1].set({
            stroke: '#3498db'
        });
    }

    onDeselected() {
        super.onDeselected();

        this.visualItems[1].set({
            stroke: '#95a5a6'
        });
    }

    getData() {
        return this.data;
    }

    setData(data) {
        this.data = data;

        const textBlock = this.childBlocks[0];
        const background = this.visualItems[0];
        const boundary = this.visualItems[1];

        let dx = textBlock.size.width;
        let dy = textBlock.size.height;

        textBlock.setLabel(this.data);

        dx = textBlock.size.width - dx;
        dy = textBlock.size.height - dy;

        this.position.x += dx / 2;
        this.position.y += dy / 2;
        this.size.width += dx;
        this.size.height += dy;

        background.set({
            width: this.size.width,
            height: this.size.height
        });

        boundary.set({
            width: this.size.width,
            height: this.size.height
        });
    }
};

mathApp.Input = class extends mathApp.Block {
    constructor(position, size) {
        super(position);

        this.position = position;
        this.size = size;
        this.type = mathApp.BLOCK_TYPES.INPUT;
        this.originalSize = { ... this.size };

        // Background
        const background = new fabric.Rect({
            left: this.position.x - this.size.width / 2,
            top: this.position.y - this.size.height / 2,
            width: this.size.width,
            height: this.size.height,
            fill: '#bdc3c7',
            stroke: 'rgba(0, 0, 0, 0)',
            rx: 6,
            ry: 6,
            selectable: false
        });

        // Boundary
        const boundary = new fabric.Rect({
            left: this.position.x - this.size.width / 2,
            top: this.position.y - this.size.height / 2,
            width: this.size.width,
            height: this.size.height,
            fill: 'rgba(0, 0, 0, 0)',
            stroke: '#95a5a6',
            strokeWidth: 2,
            rx: 6,
            ry: 6,
            selectable: false
        });

        mathApp.canvas.add(background);
        mathApp.canvas.add(boundary);
        this.visualItems.push(background);
        this.visualItems.push(boundary);
    }

    pushChildBlock(childBlock) {
        super.pushChildBlock(childBlock);

        childBlock.moveTo({
            x: this.position.x - (this.size.width / 2) + (childBlock.size.width / 2),
            y: this.position.y
        });

        this.updateBlock();
    }

    popChildBlock(childBlock) {
        super.popChildBlock(childBlock);
        this.updateBlock();
    }

    updateBlock() {
        if (this.childBlocks.length > 0) {
            this.position = { ... this.childBlocks[0].position };
            this.size = { ... this.childBlocks[0].size };
        }
        else {
            const dx = this.originalSize.width - this.size.width;
            this.position.x += dx / 2;
            this.size = { ... this.originalSize };
        }

        super.updateBlock();
    }

    makeEvalCode() {
        return `(${this.childBlocks.length > 0 ? this.childBlocks[0].makeEvalCode() : ''})`;
    }
};

mathApp.Bundle = class extends mathApp.Block {
    constructor(position) {
        super(position);

        this.position = position;
        this.type = mathApp.BLOCK_TYPES.BUNDLE;
        this.isSelectable = true;
        this.padding = { x: 10, y: 10 };

        // Background
        const background = new fabric.Rect({
            left: this.position.x,
            top: this.position.y,
            fill: 'white',
            stroke: 'rgba(0, 0, 0, 0)',
            rx: 6,
            ry: 6,
            selectable: false
        });

        // Boundary
        const boundary = new fabric.Rect({
            left: this.position.x,
            top: this.position.y,
            fill: 'rgba(0, 0, 0, 0)',
            stroke: '#95a5a6',
            strokeWidth: 2,
            rx: 6,
            ry: 6,
            selectable: false
        });

        mathApp.canvas.add(background);
        mathApp.canvas.add(boundary);
        this.visualItems.push(background);
        this.visualItems.push(boundary);
    }

    onSelected() {
        super.onSelected();

        this.visualItems[1].set({
            stroke: '#3498db'
        });
    }

    onDeselected() {
        super.onDeselected();

        this.visualItems[1].set({
            stroke: '#95a5a6'
        });
    }

    updateBlock() {
        const background = this.visualItems[0];
        const boundary = this.visualItems[1];

        background.set({
            left: this.position.x - this.size.width / 2,
            top: this.position.y - this.size.height / 2,
            width: this.size.width,
            height: this.size.height
        });

        boundary.set({
            left: this.position.x - this.size.width / 2,
            top: this.position.y - this.size.height / 2,
            width: this.size.width,
            height: this.size.height
        });

        super.updateBlock();
    }

    findInputBlockOn() {
        for (const childBlock of this.childBlocks) {
            if (childBlock.type !== mathApp.BLOCK_TYPES.INPUT) {
                continue;
            }

            if (!mathApp.checkCollision(mathApp.selectedBlock, childBlock)) {
                continue;
            }

            if (childBlock.childBlocks.length === 0) {
                return childBlock;
            }
            else {
                if (childBlock.childBlocks[0].type === mathApp.BLOCK_TYPES.BUNDLE) {
                    return childBlock.childBlocks[0].findInputBlockOn();
                }
            }

            break;
        }

        return null;
    }
};

mathApp.OperatorBundle = class extends mathApp.Bundle {
    constructor(position, display, operator) {
        super(position);

        this.position = position;
        this.bundleType = mathApp.BUNDLE_TYPES.OPERATOR;
        this.display = display;
        this.operator = operator;
        this.inputBlockSize = { width: 30, height: 30 };
        this.inputBlockGap = 20;

        this.size = {
            width: this.inputBlockSize.width * 2 + this.inputBlockGap * 2 + this.padding.x * 2,
            height: this.inputBlockSize.height + this.padding.y * 2
        };

        const textBlock = new mathApp.Text({ ... this.position }, this.display);
        this.pushChildBlock(textBlock);

        const inputBlock1 = new mathApp.Input({
            x: this.position.x - (this.inputBlockGap + this.inputBlockSize.width / 2),
            y: this.position.y
        }, { ... this.inputBlockSize });
        this.pushChildBlock(inputBlock1);

        const inputBlock2 = new mathApp.Input({
            x: this.position.x + (this.inputBlockGap + this.inputBlockSize.width / 2),
            y: this.position.y
        }, { ... this.inputBlockSize });
        this.pushChildBlock(inputBlock2);

        this.updateBlock();
    }

    makeEvalCode() {
        return this.childBlocks[1].makeEvalCode() + this.operator + this.childBlocks[2].makeEvalCode();
    }

    updateBlock() {
        const textBlock = this.childBlocks[0];
        const inputBlock1 = this.childBlocks[1];
        const inputBlock2 = this.childBlocks[2];

        inputBlock1.moveTo({
            x: inputBlock1.position.x,
            y: Math.max(inputBlock1.position.y, inputBlock2.position.y)
        });

        textBlock.moveTo({
            x: inputBlock1.position.x + inputBlock1.size.width / 2 + this.inputBlockGap,
            y: inputBlock1.position.y
        });

        inputBlock2.moveTo({
            x: textBlock.position.x + inputBlock2.size.width / 2 + this.inputBlockGap,
            y: inputBlock1.position.y
        });

        const originalWidth = this.size.width;

        this.size = {
            width: inputBlock1.size.width + inputBlock2.size.width + this.inputBlockGap * 2 + this.padding.x * 2,
            height: Math.max(inputBlock1.size.height, inputBlock2.size.height) + this.padding.y * 2
        };

        this.position.x += (this.size.width - originalWidth) / 2;
        super.updateBlock();
    }
};

$(document).ready(function () {
    mathApp.initialize();
});
