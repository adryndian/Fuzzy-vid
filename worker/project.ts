
import { Env } from './index';
import { corsHeaders } from './lib/cors';

export async function handleProjectRequest(request: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
    const { method } = request;
    const { pathname } = url;

    try {
      // POST /api/project/save
      if (method === 'POST' && pathname.endsWith('/save')) {
        const projectData = await request.json() as { project_id?: string };

        if (!projectData || !projectData.project_id) {
          return new Response(JSON.stringify({ error: 'Bad Request', message: 'Missing project_id in request body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const projectId = projectData.project_id;
        const r2Key = `projects/${projectId}/project.json`;

        await env.STORY_STORAGE.put(r2Key, JSON.stringify(projectData), {
            httpMetadata: { contentType: 'application/json' },
        });

        return new Response(JSON.stringify({ success: true, projectId, r2Key }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /api/project/:id
      if (method === 'GET' && pathname.startsWith('/api/project/')) {
        const projectId = pathname.split('/').pop();

        if (!projectId) {
          return new Response(JSON.stringify({ error: 'Bad Request', message: 'Missing project ID in URL' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const r2Key = `projects/${projectId}/project.json`;
        const projectObject = await env.STORY_STORAGE.get(r2Key);

        if (projectObject === null) {
          return new Response(JSON.stringify({ error: 'Not Found', message: `Project with ID ${projectId} not found.` }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
        return new Response(projectObject.body, { headers });
      }
      
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (e: any) {
      console.error('Project Worker Error:', e);
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
}
