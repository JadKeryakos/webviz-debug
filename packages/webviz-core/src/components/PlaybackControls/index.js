// @flow
//
//  Copyright (c) 2018-present, GM Cruise LLC
//
//  This source code is licensed under the Apache License, Version 2.0,
//  found in the LICENSE file in the root directory of this source tree.
//  You may not use this file except in compliance with the License.

// Need to import separately between disparity in import order between
// proprietary and open source repos.
import KeyListener from "react-key-listener"; // eslint-disable-line

import Tooltip from "@cruise-automation/tooltip";
import CancelIcon from "@mdi/svg/svg/cancel.svg";
import PauseIcon from "@mdi/svg/svg/pause.svg";
import PlayIcon from "@mdi/svg/svg/play.svg";
import classnames from "classnames";
import * as React from "react";
import { connect } from "react-redux";
import styled from "styled-components";

import styles from "./index.module.scss";
import { pausePlayback, seekPlayback, setPlaybackSpeed, startPlayback } from "webviz-core/src/actions/dataSource";
import Dropdown from "webviz-core/src/components/Dropdown";
import EmptyState from "webviz-core/src/components/EmptyState";
import Flex from "webviz-core/src/components/Flex";
import Icon from "webviz-core/src/components/Icon";
import Slider from "webviz-core/src/components/Slider";
import tooltipStyles from "webviz-core/src/components/Tooltip.module.scss";
import type { State as ReduxState } from "webviz-core/src/reducers";
import { DataSourceCapabilities, type DataSourceState } from "webviz-core/src/reducers/dataSource";
import colors from "webviz-core/src/styles/colors.module.scss";
import type { Timestamp } from "webviz-core/src/types/dataSources";
import { times } from "webviz-core/src/util/entities";
import { formatTime, formatTimeRaw, subtractTimes, toSec, fromSec } from "webviz-core/src/util/time";

const StyledFullWidthBar = styled.div`
  position: absolute;
  top: 17px;
  left: 0;
  right: 0;
  background-color: ${colors.textMuted};
  height: 5px;
`;

const StyledMarker = styled.div.attrs({
  style: ({ width = 0 }) => ({ left: `calc(${width * 100}% - 2px)` }),
})`
  background-color: white;
  position: absolute;
  height: 36%;
  border: 1px solid ${colors.divider};
  width: 3px;
  top: 32%;
`;

type Props = {|
  dataSource: DataSourceState,
  pause: () => void,
  play: () => void,
  setSpeed: (number) => void,
  seek: (Timestamp) => void,
|};

const TooltipItem = ({ title, value }) => (
  <div>
    <span className={styles.tipTitle}>{title}: </span>
    {value}
  </div>
);

export class UnconnectedPlaybackControls extends React.PureComponent<Props> {
  el: ?HTMLDivElement;
  slider: ?Slider;

  onChange = (value: number) => {
    const { seek } = this.props;
    const time = fromSec(value);
    seek(time);
  };

  keyDownHandlers = {
    " ": () => {
      const { pause, play, dataSource } = this.props;
      const { isPlaying } = dataSource;

      if (isPlaying) {
        pause();
      } else {
        play();
      }
    },
  };

  onMouseMove = (e: SyntheticMouseEvent<HTMLDivElement>) => {
    const { startTime, endTime } = this.props.dataSource;
    const { el, slider } = this;
    if (!startTime || !endTime || !el || !slider) {
      return;
    }
    const x = e.clientX;
    // fix the y position of the tooltip to float on top of the
    // playback bar
    const y = el.getBoundingClientRect().top;

    const value = slider.getValueAtMouse(e);
    const stamp = fromSec(value);
    const timeFromStart = subtractTimes(stamp, startTime);

    const tip = (
      <div className={classnames(tooltipStyles.tooltip, styles.tip)}>
        <TooltipItem title={"ROS"} value={formatTimeRaw(stamp)} />
        <TooltipItem title={"Time"} value={formatTime(stamp)} />
        <TooltipItem title={"Elapsed"} value={`${toSec(timeFromStart).toFixed(9)} sec`} />
      </div>
    );
    Tooltip.show(x, y, tip, {
      placement: "top",
      offset: { x: 0, y: 0 },
      arrow: <div className={tooltipStyles.arrow} />,
    });
  };

  onMouseLeave = (e: SyntheticMouseEvent<HTMLDivElement>) => {
    Tooltip.hide();
  };

  render() {
    const { pause, play, setSpeed, dataSource } = this.props;
    const { isPlaying, startTime, endTime, currentTime, speed, capabilities, isConnecting } = dataSource;

    if (!startTime || !endTime) {
      const message =
        isConnecting && capabilities.includes(DataSourceCapabilities.initialization) ? (
          "Data source is initializing..."
        ) : (
          <span>
            Drop a <a href="http://wiki.ros.org/ROS/Tutorials/Recording%20and%20playing%20back%20data">ROS bag file</a>{" "}
            to get started. Or check out <a href="worldview">Worldview</a> and other pacakges on{" "}
            <a href="https://github.com/cruise-automation">Github</a>!
          </span>
        );
      return (
        <Flex row className={classnames(styles.container, styles.disconnected)}>
          <Icon large clickable={false}>
            <CancelIcon />
          </Icon>
          <EmptyState alignLeft>{message}</EmptyState>
        </Flex>
      );
    }

    const min = toSec(startTime);
    const max = toSec(endTime);
    const value = currentTime == null ? null : toSec(currentTime);
    const step = (max - min) / 500;

    return (
      <Flex row className={styles.container}>
        <KeyListener global keyDownHandlers={this.keyDownHandlers} />
        <div className={styles.playIconWrapper} onClick={isPlaying ? pause : play}>
          <Icon large>{isPlaying ? <PauseIcon /> : <PlayIcon />}</Icon>
        </div>
        <div>
          {speed != null && speed !== 0 && (
            <Dropdown position="above" value={speed} text={`${speed.toFixed(1)}${times}`} onChange={setSpeed}>
              <span value={0.1}>0.1&times;</span>
              <span value={0.2}>0.2&times;</span>
              <span value={0.5}>0.5&times;</span>
              <span value={1}>1.0&times;</span>
            </Dropdown>
          )}
        </div>

        <div className={styles.bar}>
          <StyledFullWidthBar />
          <div
            ref={(el) => (this.el = el)}
            className={styles.sliderContainer}
            onMouseMove={this.onMouseMove}
            onMouseLeave={this.onMouseLeave}>
            <Slider
              ref={(slider) => (this.slider = slider)}
              min={min}
              max={max}
              step={step}
              value={value}
              draggable
              onChange={this.onChange}
              renderSlider={(value) => (value == null ? null : <StyledMarker width={value} />)}
            />
          </div>
        </div>
      </Flex>
    );
  }
}

const mapStateToProps = (state: ReduxState): $Shape<Props> => {
  return {
    dataSource: state.dataSource,
  };
};

const PlaybackControls: React.ComponentType<{}> = connect(
  mapStateToProps,
  {
    pause: pausePlayback,
    play: startPlayback,
    seek: seekPlayback,
    setSpeed: setPlaybackSpeed,
  }
)(UnconnectedPlaybackControls);
PlaybackControls.displayName = "PlaybackControls";

export default PlaybackControls;