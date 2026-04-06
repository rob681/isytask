"use client";

import React, { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { VideoPlayer, type VideoComment } from "./video-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, MessageCircle, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/hooks/use-toast";

interface VideoReviewPanelProps {
  videoUrl: string;
  mediaType: "POST_MEDIA" | "TASK_FILE";
  mediaId: string;
  initialComments?: VideoComment[];
  readOnly?: boolean;
}

interface CommentFormInput {
  content: string;
}

export function VideoReviewPanel({
  videoUrl,
  mediaType,
  mediaId,
  initialComments = [],
  readOnly = false,
}: VideoReviewPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [comments, setComments] = useState<VideoComment[]>(initialComments);
  const [currentTime, setCurrentTime] = useState(0);
  const { toast } = useToast();
  const { register, handleSubmit, reset, watch } = useForm<CommentFormInput>({
    defaultValues: { content: "" },
  });

  const contentValue = watch("content");

  // tRPC mutations
  const createCommentMutation = trpc.videoComments.create.useMutation();
  const listCommentsQuery = trpc.videoComments.listByMedia.useQuery({
    mediaType,
    mediaId,
  });

  // Update comments when query changes
  React.useEffect(() => {
    if (listCommentsQuery.data) {
      setComments(listCommentsQuery.data);
    }
  }, [listCommentsQuery.data]);

  // Refresh comments list
  const refreshComments = async () => {
    await listCommentsQuery.refetch();
  };

  // Handle comment submission
  const onSubmit = async (data: CommentFormInput) => {
    try {
      // Capture current video time
      const timecodeSeconds = videoRef.current?.currentTime ?? undefined;

      await createCommentMutation.mutateAsync({
        mediaType,
        mediaId,
        content: data.content,
        timecodeSeconds,
        isInternal: false,
      });

      // Add optimistic update
      const newComment: VideoComment = {
        id: `temp-${Date.now()}`,
        content: data.content,
        authorId: "",
        author: {
          id: "",
          name: "You",
          email: "",
          avatarUrl: null,
        },
        timecodeSeconds: timecodeSeconds ?? null,
        isInternal: false,
        isResolved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setComments((prev) => [...prev, newComment]);
      reset();

      // Refresh from server
      setTimeout(() => refreshComments(), 500);

      toast({
        title: "Comentario agregado",
        description: timecodeSeconds
          ? `en ${Math.floor(timecodeSeconds / 60)}:${Math.floor(timecodeSeconds % 60)
              .toString()
              .padStart(2, "0")}`
          : "sin timestamp",
      });
    } catch (err: any) {
      toast({
        title: "Error al agregar comentario",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Handle marker click to seek
  const handleMarkerClick = (timecodeSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timecodeSeconds;
    }
  };

  // Format time
  const formatTime = (seconds: number | null | undefined) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Left: Video Player */}
      <div className="flex-1 min-w-0">
        <VideoPlayer
          ref={videoRef}
          src={videoUrl}
          mediaType={mediaType}
          mediaId={mediaId}
          comments={comments}
          onSeek={(time) => setCurrentTime(time)}
          readOnly={readOnly}
          className="h-full"
        />
      </div>

      {/* Right: Comments Sidebar */}
      <div className="w-80 flex flex-col border-l bg-muted/30">
        {/* Header */}
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Comentarios ({comments.length})
          </h3>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto space-y-3 p-4">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">
                {readOnly
                  ? "Sin comentarios"
                  : "Sin comentarios aún. ¡Sé el primero!"}
              </p>
            </div>
          ) : (
            comments.map((comment) => (
              <Card
                key={comment.id}
                className={cn(
                  "p-3 cursor-pointer transition-all hover:shadow-md",
                  comment.isResolved && "opacity-60"
                )}
                onClick={() => {
                  if (comment.timecodeSeconds) {
                    handleMarkerClick(comment.timecodeSeconds);
                  }
                }}
              >
                {/* Time badge + status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  {comment.timecodeSeconds !== null ? (
                    <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-2 py-1 rounded">
                      {formatTime(comment.timecodeSeconds)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin timestamp</span>
                  )}
                  {comment.isResolved && (
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  )}
                  {comment.isInternal && (
                    <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100 px-2 py-0.5 rounded">
                      Interno
                    </span>
                  )}
                </div>

                {/* Comment content */}
                <p className="text-sm mb-2 line-clamp-3">{comment.content}</p>

                {/* Author info */}
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{comment.author.name}</p>
                  <p>{new Date(comment.createdAt).toLocaleDateString("es-MX")}</p>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Comment Form */}
        {!readOnly && (
          <div className="p-4 border-t bg-background space-y-3">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
              <div className="relative">
                <input
                  {...register("content")}
                  type="text"
                  placeholder="Escribe tu feedback..."
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={createCommentMutation.isPending}
                  maxLength={500}
                />
                {currentTime > 0 && contentValue && (
                  <div className="absolute right-2 top-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-2 py-0.5 rounded">
                    {formatTime(currentTime)}
                  </div>
                )}
              </div>

              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>⏱️ Timestamp capturado automáticamente</span>
              </div>

              <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={
                  !contentValue.trim() || createCommentMutation.isPending
                }
              >
                {createCommentMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Enviar (Ctrl+Enter)
                  </>
                )}
              </Button>
            </form>

            {/* Keyboard shortcut hint */}
            <p className="text-xs text-muted-foreground text-center">
              💡 Pausa el video en el momento exacto antes de comentar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
