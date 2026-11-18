// jsdom has no canvas: say so quietly (null, as a browser without one would) instead of logging "not implemented".
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
