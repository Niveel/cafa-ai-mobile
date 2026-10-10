import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { AppPromptModal, AppScreen, RequireAuthRoute } from "@/components";
import { useAppTheme, useI18n } from "@/hooks";
import { useLatest } from "@/features/movieStudio/hooks/useLatest";
import { movieStudioApi } from "@/features/movieStudio/data/api";
import { CharactersStage } from "@/features/movieStudio/components/CharactersStage";
import { ConfigurationStage } from "@/features/movieStudio/components/ConfigurationStage";
import { EditorStage } from "@/features/movieStudio/components/EditorStage";
import { ExportStage } from "@/features/movieStudio/components/ExportStage";
import { ScenesStage } from "@/features/movieStudio/components/ScenesStage";
import { ScriptStage } from "@/features/movieStudio/components/ScriptStage";
import { StudioGateModals } from "@/features/movieStudio/components/StudioGateModals";
import { StudioHeaderActions } from "@/features/movieStudio/components/StudioHeaderActions";
import { StudioIcon } from "@/features/movieStudio/components/StudioIcon";
import { StudioProgress } from "@/features/movieStudio/components/StudioProgress";
import {
  resolveResume,
  type ResumeStage,
} from "@/features/movieStudio/domain/rules";
import type { Project } from "@/features/movieStudio/domain/types";
import type { StudioIconName } from "@/features/movieStudio/studioIconNames";
import { ICON, useStudioPalette } from '@/features/movieStudio/theme';


const MANUAL_TABS: { stage: ResumeStage; key: string; icon: StudioIconName }[] =
  [
    { stage: "script", key: "script", icon: "file-text" },
    { stage: "characters", key: "characters", icon: "users" },
    { stage: "scenes", key: "scenes", icon: "images" },
    { stage: "editor", key: "edit", icon: "clapperboard" },
    { stage: "export", key: "export", icon: "film" },
  ];
const VALID_STAGES: ResumeStage[] = [
  "configuration",
  "script",
  "characters",
  "scenes",
  "editor",
  "export",
];

/**
 * Hosts one Movie Studio project. Auto projects walk the guided steps (progress bar 01 to 06); Manual projects
 * get a non-linear workspace (section nav) over the same Script, Characters, Scenes, Editor and Export stages.
 */
export default function StudioProjectScreen() {
  const { id, stage: stageParam } = useLocalSearchParams<{
    id: string;
    stage?: string;
  }>();
  const { colors } = useAppTheme();
  const P = useStudioPalette();
  const { t } = useI18n();
  const [project, setProject] = useState<Project | null>(null);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [stage, setStage] = useState<ResumeStage>("script");
  // Manual tab strip: keep the selected tab fully in view on narrow screens.
  const tabScroll = useRef<ScrollView>(null);
  const tabX = useRef<Record<string, number>>({});
  useEffect(() => {
    const x = tabX.current[stage];
    if (x !== undefined) tabScroll.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
  }, [stage]);
  const [error, setError] = useState<string | null>(null);
  const tRef = useLatest(t);
  const [dirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [discardBusy, setDiscardBusy] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const reportDirty = useCallback((value: boolean) => setDirty(value), []);

  // Any navigation away from a stage with unsaved edits asks first.
  const guard = (action: () => void) => () =>
    dirty ? setPendingNav(() => action) : action();

  // Drawer screens stay mounted, so reload on every focus: reopening a project must read the server's step, not the last in-memory one.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setProject(null);
      setError(null);
      movieStudioApi
        .listProjects()
        .then((list) => {
          if (cancelled) return;
          const found = list.find((p) => p.id === id);
          if (!found) return setError(tRef.current("studio.loadFailed"));
          const resume = resolveResume(found);
          setProject(found);
          setMode(resume.mode);
          const requested = VALID_STAGES.find((s) => s === stageParam);
          // Manual projects have no configuration step; a fresh Auto project starts at configuration.
          const fallback: ResumeStage =
            resume.stage === "video-type" || resume.stage === "configuration"
              ? resume.mode === "manual"
                ? "script"
                : "configuration"
              : resume.stage;
          setStage(
            requested &&
              !(resume.mode === "manual" && requested === "configuration")
              ? requested
              : fallback,
          );
        })
        .catch(
          (e) =>
            !cancelled &&
            setError(
              e instanceof Error
                ? e.message
                : tRef.current("studio.loadFailed"),
            ),
        );
      return () => {
        cancelled = true;
      };
    }, [id, stageParam, tRef]),
  );

  const goBack = guard(() => {
    if (mode === "manual") return router.replace("/(drawer)/studio");
    if (stage === "configuration") return router.replace("/(drawer)/studio");
    if (stage === "script") return setStage("configuration");
    if (stage === "characters") return setStage("script");
    if (stage === "scenes") return setStage("characters");
    if (stage === "editor") return setStage("scenes");
    if (stage === "export") return setStage("editor");
    router.replace("/(drawer)/studio");
  });

  const next = (target: ResumeStage) => guard(() => setStage(target));

  const discard = async () => {
    if (!project || discardBusy) return;
    setDiscardBusy(true);
    setDiscardError(null);
    try {
      await movieStudioApi.deleteProject(project.id); // 404 counts as already deleted
      setDiscarding(false);
      setDirty(false);
      router.replace("/(drawer)/studio");
    } catch (e) {
      setDiscardError(
        e instanceof Error && e.message ? e.message : t("studio.delete.failed"),
      );
    } finally {
      setDiscardBusy(false);
    }
  };

  const renderStage = (p: Project) => {
    switch (stage) {
      case "configuration":
        return (
          <ConfigurationStage
            project={p}
            onBack={goBack}
            onDirtyChange={reportDirty}
            onSaved={(updated) => {
              setProject(updated);
              setStage("script");
            }}
          />
        );
      case "script":
        return (
          <ScriptStage
            key={p.id}
            project={p}
            mode={mode}
            onBack={goBack}
            onContinue={next("characters")}
            onDirtyChange={reportDirty}
          />
        );
      case "characters":
        return (
          <CharactersStage
            key={p.id}
            project={p}
            onBack={mode === "auto" ? goBack : undefined}
            onContinue={next("scenes")}
            onDirtyChange={reportDirty}
          />
        );
      case "scenes":
        return (
          <ScenesStage
            key={p.id}
            project={p}
            onBack={mode === "auto" ? goBack : undefined}
            onContinue={next("editor")}
            onDirtyChange={reportDirty}
          />
        );
      case "editor":
        return (
          <EditorStage
            key={p.id}
            project={p}
            onBack={mode === "auto" ? goBack : undefined}
            onContinue={next("export")}
            onOpenScenes={next("scenes")}
          />
        );
      default:
        return (
          <ExportStage
            key={p.id}
            project={p}
            onBack={mode === "auto" ? goBack : undefined}
            onOpenEditor={next("editor")}
            onProjectCompleted={setProject}
          />
        );
    }
  };

  const unfinished = project !== null && project.status !== "complete";

  return (
    <RequireAuthRoute>
      <AppScreen
        title={project?.title ?? t("drawer.studio")}
        onBackPress={goBack}
        topAuthRightContent={
          <StudioHeaderActions
            onDiscard={unfinished ? () => setDiscarding(true) : undefined}
          />
        }
      >
        {project && mode === "auto" ? (
          <StudioProgress
            stage={stage}
            onSelect={(target) => guard(() => setStage(target))()}
          />
        ) : null}

        {mode === "manual" && project ? (
          <ScrollView
            ref={tabScroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginBottom: 12 }}
            contentContainerStyle={{ gap: 8, paddingRight: 16 }}
          >
            {MANUAL_TABS.map((tab) => {
              const on = stage === tab.stage;
              return (
                <Pressable
                  key={tab.stage}
                  onLayout={(e) => {
                    tabX.current[tab.stage] = e.nativeEvent.layout.x;
                    if (on) tabScroll.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 16), animated: false });
                  }}
                  onPress={guard(() => setStage(tab.stage))}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  className="flex-row items-center rounded-2xl border px-3 py-2"
                  style={{
                    gap: 8,
                    minHeight: 48,
                    borderColor: on ? P.accent : P.border,
                    backgroundColor: on ? `${P.accent}38` : "transparent",
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: on ? P.accent : `${P.accent}38`,
                    }}
                  >
                    <StudioIcon
                      name={tab.icon}
                      size={16}
                      color={on ? "#FFFFFF" : ICON}
                    />
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.textPrimary,
                        fontSize: 13,
                        fontWeight: on ? "700" : "600",
                      }}
                    >
                      {t(`studio.manual.tab.${tab.key}`)}
                    </Text>
                    <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 10 }}>
                      {t(`studio.manual.tab.${tab.key}Sub`)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={{ flex: 1 }}>
          {error ? (
            <Text style={{ color: "#EF4444", fontSize: 13 }}>{error}</Text>
          ) : !project ? (
            <ActivityIndicator color={ICON} style={{ marginTop: 24 }} />
          ) : (
            renderStage(project)
          )}
        </View>

        <AppPromptModal
          visible={pendingNav !== null}
          icon={<StudioIcon name="triangle-alert" size={20} color="#F59E0B" />}
          iconBackground="#F59E0B22"
          confirmTone="danger"
          title={t("studio.leave.title")}
          message={t("studio.leave.message")}
          confirmLabel={t("studio.leave.confirm")}
          cancelLabel={t("studio.common.cancel")}
          onConfirm={() => {
            const action = pendingNav;
            setPendingNav(null);
            setDirty(false);
            action?.();
          }}
          onCancel={() => setPendingNav(null)}
          onDismiss={() => setPendingNav(null)}
        />
        <AppPromptModal
          visible={discarding}
          icon={<StudioIcon name="trash-2" size={20} color="#EF4444" />}
          iconBackground="#EF444422"
          confirmTone="danger"
          title={t("studio.delete.title")}
          message={
            discardError ??
            t("studio.delete.message", { title: project?.title ?? "" })
          }
          confirmLabel={
            discardBusy
              ? t("studio.common.deleting")
              : t("studio.delete.confirm")
          }
          cancelLabel={t("studio.common.cancel")}
          onConfirm={() => void discard()}
          onCancel={() => setDiscarding(false)}
          onDismiss={() => setDiscarding(false)}
        />
        <StudioGateModals />
      </AppScreen>
    </RequireAuthRoute>
  );
}
