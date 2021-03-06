import { v4 } from "node-uuid";
import PropTypes from "prop-types";
import React from "react";
import { PinchView } from "react-pinch-zoom-pan";
import { DropTarget } from "react-dnd";
import $ from "jquery";

import ProgressBar from "react-progress-bar-plus";
import "react-progress-bar-plus/lib/progress-bar.css";

import nodeData from "../../static/assets/nipype.json";
import ItemTypes from "./itemTypes";
import Links from "./links";
import Nodes from "./nodes";
import { loadPorkFile } from "../utils/loadPorkFile";

const ZoomIn = () => {
  return (
    <div id="icon-plus" className="canvas-icon">
      <p>Press</p>
      <button className="btn btn-default text-center">
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
};

const ZoomOut = () => {
  return (
    <div id="icon-minus" className="canvas-icon">
      <p>Press</p>
      <button className="btn btn-default text-center">
        <span aria-hidden="true">-</span>
      </button>
    </div>
  );
};

const boxTarget = {
  drop(props, monitor, component) {
    component.drop(monitor.getItem(), monitor.getClientOffset());
    return { name: "Canvas" };
  }
};

class Canvas extends React.Component {
  constructor(props) {
    super(props);
    this.allowDrop = this.allowDrop.bind(this);
    this.drop = this.drop.bind(this);
    this.clickCanvas = this.clickCanvas.bind(this);
    this.loadFromJson = this.loadFromJson.bind(this);
    this.setPercent = this.setPercent.bind(this);
  }

  setPercent(percent) {
    if (percent >= 100) {
      this.props.updateLoadingPercent(99.9);
      // Always leave percent at -1
      this.timeout = setTimeout(() => {
        this.props.updateLoadingPercent(-1);
      }, 400);
    } else {
      this.props.updateLoadingPercent(percent);
    }
  }

  componentDidMount() {
    // #TODO remove/replace zoomFunctions in issue #73
    // setBoundingBox();
    // this.mouseState = zoomFunctions();
  }

  componentWillMount() {
    if (ConfigError) {
      console.log(ConfigError);
    } else if (jsonFile) {
      $.getJSON(
        jsonFile,
        function(result) {
          this.loadFromJson(result);
        }.bind(this)
      )
        .done(function() {
          console.log("Porcupine Config file loaded from URL");
        })
        .fail(function() {
          console.log("Cannot load Porcupine Config file");
          this.setPercent(-1);
        });
    }
  }

  loadFromJson(json) {
    this.setPercent(10); // Loading started!

    const { addNode, addLink, clearDatabase } = this.props;
    //pass by reference and fill them in the load functions
    let nodes = [];
    let links = [];
    try {
      loadPorkFile(json, nodes, links, this.setPercent);
    } catch (err) {
      console.log(
        "Error reading Porcupine Config file! Either data is missing or format is incorrect"
      );
      this.setPercent(-1);
    }
    clearDatabase();
    try {
      nodes.forEach(node => {
        addNode(node);
        this.props.repositionPorts(node);
      });
      links.forEach(link => {
        addLink(link);
      });
    } catch (err) {
      console.log(
        "Error while adding Link or Node to Canvas, Check Porcupine Config file "
      );
    }
  }

  componentDidUpdate() {
    this.placeholder = false;
  }

  allowDrop(event) {
    event.preventDefault();
  }

  drop(item, offset) {
    const { addNode, addPortToNode } = this.props;

    this.placeholder = false;
    const rec = document.getElementById("main").getBoundingClientRect();
    // #TODO to be updated as part of #73:
    // const canvas = document.getElementById('jsplumbContainer');
    // const zoom = instance.getZoom();
    const zoom = 1;

    let category = item.element_type;
    let name = category.splice(-1)[0];
    let currentNodes = nodeData;
    category.forEach(function(c) {
      currentNodes = currentNodes["categories"][c];
    });
    const node = $.extend(true, {}, currentNodes.nodes[name]);
    node.ports ? node.ports : {};
    node.ports = node.ports.map(port => {
      // #TODO link to a proper default value
      return {
        ...port,
        id: v4(),
        value: port.value || port.default || ""
      };
    });

    const newNode = {
      id: v4(),
      name: name,
      // #TODO fix positioning of dropped node, issue #73
      x: (offset.x - rec.left) / zoom - 45,
      y: (offset.y - rec.top) / zoom - 25,
      width: name.length * 12,
      colour: currentNodes.colour,
      ports: node.ports,
      web_url: node.title.web_url || ""
    };

    addNode(newNode);
    repositionPorts(newNode);
  }

  clickCanvas(event) {
    const { clickScene } = this.props;
    clickScene();
    event.preventDefault();
    event.stopPropagation();
  }

  render() {
    const { canDrop, isOver, connectDropTarget, nodes, links } = this.props;
    const isActive = canDrop && isOver;

    let backgroundColor = "#222";
    if (isActive) {
      backgroundColor = "darkgreen";
    } else if (canDrop) {
      backgroundColor = "darkkhaki";
    }

    return connectDropTarget(
      <div
        className="canvas"
        onDragOver={this.allowDrop}
        onClick={this.clickCanvas}
      >
        <ProgressBar
          percent={this.props.loadingPercent}
          onTop={true}
          spinner={"right"}
        />
        {/* {errors} */}
        {nodes.length == 0 ? (
          <h4 className="text-center" id="placeholder">
            Drag your nodes here!
          </h4>
        ) : (
          ""
        )}
        {/* #TODO replace this container, issue #73 */}

        <PinchView>
          <div id="mainSurface">
            <Nodes nodes={nodes} />
            <Links links={links} />
          </div>
        </PinchView>

        <ZoomIn />
        <ZoomOut />
      </div>
    );
  }
}

Canvas.propTypes = {
  // connectDropTarget:    PropTypes.func.isRequired,
  isOver: PropTypes.bool.isRequired,
  canDrop: PropTypes.bool.isRequired
};

export default (Canvas = DropTarget(
  ItemTypes.PaneElement,
  boxTarget,
  (connection, monitor) => ({
    connectDropTarget: connection.dropTarget(),
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop()
  })
)(Canvas));
