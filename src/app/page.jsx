"use client";
import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";
import { toast } from "sonner";
import {
  FlipHorizontal,
  Camera,
  Video,
  PersonStanding,
  Volume2,
} from "lucide-react";
import { Rings } from "react-loader-spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { beep } from "@/utils/audio";
import { Slider } from "@/components/ui/slider";
import { drawOnCanvas } from "@/utils/draw";
import { ModeToggle } from "@/components/toogle";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export default function Page() {
  const webCamRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  let stopTimeout = null;
  const [mirrored, setMirrored] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [autoRecord, setAutoRecord] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!model) {
      setLoading(true);
      initModel();
    } else {
      setLoading(false);
    }
  }, [model]);

  useEffect(() => {
    if (webCamRef && webCamRef.current) {
      const stream = webCamRef.current.video.captureStream();
      if (stream) {
        mediaRecorderRef.current = new MediaRecorder(stream);

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) {
            const recordedBlob = new Blob([e.data], { type: "video" });
            const videoUrl = URL.createObjectURL(recordedBlob);

            const a = document.createElement("a");
            a.href = videoUrl;
            a.download = `${formatDate(new Date())}.webm`;
            a.click();
          }
        };
        mediaRecorderRef.current.onstart = (e) => {
          setIsRecording(true);
        };
        mediaRecorderRef.current.onstop = (e) => {
          setIsRecording(false);
        };
      }
    }
  }, [webCamRef]);

  const formatDate = (d) => {
    const formatdate =
      [
        (d.getMonth() + 1).toString().padStart(2, "0"),
        d.getDate().toString().padStart(2, "0"),
        d.getFullYear(),
      ].join("-") +
      " " +
      [
        d.getHours().toString().padStart(2, "0"),
        d.getMinutes().toString().padStart(2, "0"),
        d.getSeconds().toString().padStart(2, "0"),
      ].join("-");
    return formatdate;
  };

  async function runPrediction() {
    if (
      model &&
      webCamRef.current &&
      webCamRef.current.video &&
      webCamRef.current.video.readyState === 4
    ) {
      const prediction = await model.detect(webCamRef.current.video);
      resizeCanvas();
      drawOnCanvas(mirrored, prediction, canvasRef.current?.getContext("2d"));
      let isPerson = false;
      if (prediction.length > 0) {
        prediction.forEach((predict) => {
          isPerson = predict.class === "person";
        });
        if (isPerson && autoRecord) {
          startRecord(true);
        }
      }
    }
  }

  useEffect(() => {
    const interval = setInterval(() => runPrediction(), 100);
    return () => clearInterval(interval);
  }, [model, webCamRef.current, mirrored, autoRecord]);

  function resizeCanvas() {
    const canvas = canvasRef.current;
    const video = webCamRef.current?.video;
    if (canvas && video) {
      const { videoWidth, videoHeight } = video;
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }
  }

  async function initModel() {
    const loadedModel = await cocoSsd.load({ base: "mobilenet_v2" });
    setModel(loadedModel);
  }

  function base64ToBlob(base64String) {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");

    const binaryString = atob(base64Data);

    const arrayBuffer = new ArrayBuffer(binaryString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: "image/png" });
  }
  const UserScreenshot = () => {
    if (!webCamRef.current) {
      toast("Camera not found . Please Refresh");
    } else {
      const ingSrc = webCamRef.current.getScreenshot();
      const blob = base64ToBlob(ingSrc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${formatDate(new Date())}.png`;
      a.click();
    }
  };

  const UserRecord = () => {
    if (!webCamRef.current) {
      toast("Camera is not Found please refresh");
    }

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
      toast("Recording saved to downloads");
    } else {
      startRecord(false);
    }
  };

  const startRecord = (doBeep) => {
    if (webCamRef.current && mediaRecorderRef.current?.state !== "recording") {
      mediaRecorderRef.current?.start();
      doBeep && beep(volume);
      stopTimeout = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.requestData();
          mediaRecorderRef.current.stop();
        }
      }, 30000);
    }
  };
  const toggleAutoRecord = () => {
    setAutoRecord((prev) => !prev);
    toast(autoRecord ? "AutoRecord Disabled" : "AutoRecord Enabled");
  };

  const volumeCommit = (val) => {
    setVolume(val[0]);
    beep(val[0]);
  };

  return (
    <div className="h-screen flex">
      <div className="relative">
        <div className="relative h-screen w-full">
          <Webcam
            ref={webCamRef}
            mirrored={mirrored}
            className="w-full h-full object-contain p-2"
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 h-full w-full object-contain"
          ></canvas>
        </div>
      </div>

      <div className="flex flex-1">
        <div className="border-primary/5 border-2 max-w-xs flex flex-col gap-2 justify-between shadow-md rounded-md p-4">
          <div className="flex flex-col gap-2">
            <ModeToggle />
            <Button
              onClick={() => setMirrored((prev) => !prev)}
              variant="outline"
              size="icon"
            >
              <FlipHorizontal />
            </Button>
            <Separator className="my-2" />
          </div>

          <div className="flex flex-col gap-2">
            <Separator className="my-2" />
            <Button onClick={UserScreenshot} variant="outline" size="icon">
              <Camera />
            </Button>
            <Button
              onClick={UserRecord}
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
            >
              <Video />
            </Button>
            <Separator className="my-2" />
            <Button
              variant={autoRecord ? "destructive" : "outline"}
              size="icon"
              onClick={toggleAutoRecord}
            >
              {autoRecord ? (
                <Rings
                  visible={true}
                  height="45"
                  color="white"
                  ariaLabel="rings-loading"
                />
              ) : (
                <PersonStanding />
              )}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Separator className="my-2" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                  <Volume2 />
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Slider
                  max={1}
                  min={0}
                  step={0.2}
                  defaultValue={[volume]}
                  onValueCommit={volumeCommit}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="h-full hidden flex-1 py-4 px-2 overflow-y-scroll lg:flex">
          <RenderFeatureHighlightsSection />
        </div>
      </div>

      {loading && (
        <div className="absolute z-50 w-full h-full flex items-center justify-center bg-primary-foreground">
          Getting Things ready... <Rings height={50} color="red" />
        </div>
      )}
    </div>
  );

  function RenderFeatureHighlightsSection() {
    return (
      <div className="text-xs text-muted-foreground">
        <ul className="space-y-4">
          <FeatureItem
            title="Dark Mode/Sys Theme 🌓"
            description="Toggle between dark mode and system theme"
          />
          <FeatureItem
            title="Horizontal flip ↔️"
            description="Toggle between dark mode and system theme"
          />
          <Separator />
          <FeatureItem
            title="Take Pictures 📷"
            description="Capture snapshots at any moment from the video feed."
          />
          <FeatureItem
            title="Manual Video Recording 📽️"
            description="Manually record video clips as needed"
          />
          <Separator />
          <FeatureItem
            title="Enable/Disable Auto Record 🚫"
            description="Option to enable/disable automatic video recording whenever required"
          />
          <FeatureItem
            title="Volume Slider 🪄"
            description="Adjust the volume level of the notifications"
          />
          <FeatureItem
            title="Camera feed highlighting ↔️"
            description="Highlights persons in red and other objects in green"
          />
          <Separator />
          <li className="space-y-4">
            <strong>Share your thoughts 💭</strong>
            <br />
            <br />
            <br />
          </li>
        </ul>
      </div>
    );
  }

  function FeatureItem({ title, description }) {
    return (
      <li>
        <strong>{title}</strong>
        <p>{description}</p>
      </li>
    );
  }
}
