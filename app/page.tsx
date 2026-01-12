import prisma from "../lib/db";
import UploadForm from "./components/UploadForm";
import ProcessForm from "./components/ProcessForm";
import WorkerRun from "./components/WorkerRun";

export const dynamic = "force-dynamic";

export default async function Home() {
  const videos = await prisma.video.findMany({
    orderBy: { created_at: "desc" },
    include: {
      moments: { orderBy: { rank: "asc" } },
      clip_assets: true,
    },
  });

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>Video Atomization</h1>
      <UploadForm />
      <WorkerRun />
      {videos.length === 0 ? (
        <p>No videos yet.</p>
      ) : (
        videos.map((video) => (
          <section key={video.id} style={{ marginBottom: 32 }}>
            <h2>Video {video.id}</h2>
            <p>
              Source: {video.source_path ? (
                <a href={video.source_path} target="_blank" rel="noreferrer">
                  {video.source_path}
                </a>
              ) : (
                "(missing)"
              )}
            </p>
            <ProcessForm videoId={video.id} />
            <h3>Moments</h3>
            {video.moments.length === 0 ? (
              <p>No moments.</p>
            ) : (
              <ul>
                {video.moments.map((moment) => {
                  const horizontal = video.clip_assets.find(
                    (clip) =>
                      clip.moment_id === moment.id &&
                      clip.orientation === "horizontal"
                  );
                  const vertical = video.clip_assets.find(
                    (clip) =>
                      clip.moment_id === moment.id &&
                      clip.orientation === "vertical"
                  );

                  return (
                    <li key={moment.id} style={{ marginBottom: 12 }}>
                      <div>
                        <strong>
                          {moment.rank}. {moment.title}
                        </strong>
                      </div>
                      <div>
                        {moment.start_ms}ms → {moment.end_ms}ms
                      </div>
                      <div>
                        {horizontal ? (
                          <a
                            href={horizontal.file_path}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Horizontal
                          </a>
                        ) : (
                          "Horizontal: pending"
                        )}
                        {" | "}
                        {vertical ? (
                          <a
                            href={vertical.file_path}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Vertical
                          </a>
                        ) : (
                          "Vertical: pending"
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))
      )}
    </main>
  );
}
