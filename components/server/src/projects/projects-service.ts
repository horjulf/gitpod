/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { DBWithTracing, ProjectDB, TeamDB, TracedWorkspaceDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { CreateProjectParams, PrebuildInfo, PrebuiltWorkspace, Project, ProjectInfo, User } from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "../auth/host-context-provider";
import { parseRepoUrl } from "../repohost";

@injectable()
export class ProjectsService {

    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;

    async getProjects(teamId: string): Promise<ProjectInfo[]> {
        const result: ProjectInfo[] = [];
        const toProjectInfo = async (p: Project) => {
            const result: ProjectInfo = { ...p };
            result.lastPrebuild = await this.getLastPrebuild(p);
            return result;
        };
        const projects = await this.projectDB.findProjectsByTeam(teamId);
        result.push(...(await Promise.all(projects.map(toProjectInfo))));
        return result;
    }

    async getProjectOverview(user: User, teamId: string, projectName: string): Promise<Project.Overview | undefined> {
        const project = await this.projectDB.findProject(teamId, projectName);
        if (!project) {
            return undefined;
        }

        const result: Project.Overview = {};

        const branches = await this.getBranchDetails(user, project);
        for (const branch of branches) {
            result[branch.name] = branch;
        }

        return result;
    }

    async getBranchDetails(user: User, project: Project): Promise<Project.BranchDetails[]> {
        const parsedUrl = parseRepoUrl(project.cloneUrl);
        if (!parsedUrl) {
            return [];
        }
        const { owner, repo, host } = parsedUrl;
        const repositoryProvider = this.hostContextProvider.get(host)?.services?.repositoryProvider;
        if (!repositoryProvider) {
            return [];
        }
        // const repository = await repositoryProvider.getRepo(user, owner, repo); // todo: set default branch
        const branches = await repositoryProvider.getBranches(user, owner, repo);

        const result: Project.BranchDetails[] = [];
        for (const branch of branches) {
            const lastPrebuild = await this.getLastPrebuild(project, branch.name)
            result.push({
                name: branch.name,
                branchUrl: "branchUrl",
                changeAuthor: branch.author,
                changeDate: branch.authorDate,
                changeHash: branch.sha,
                changeTitle: branch.commitMessage,
                changeAuthorAvatar: branch.authorAvatarUrl,
                isDefault: false,
                changePR: "changePR",
                changeUrl: "changeUrl",
                lastPrebuild
            });
        }
        return result;
    }

    async createProject({ name, cloneUrl, teamId, appInstallationId }: CreateProjectParams): Promise<Project> {
        return this.projectDB.storeProject(Project.create({ name, cloneUrl, teamId, appInstallationId }));
    }

    async getLastPrebuild(project: Project, branch?: string): Promise<PrebuildInfo | undefined> {
        const prebuilds = await this.workspaceDb.trace({}).findPrebuiltWorkspacesByProject(project.id, branch || (await this.getDefaultBranch(project)));
        const prebuild = prebuilds[prebuilds.length - 1];
        if (!prebuild) {
            return undefined;
        }
        return await this.toPrebuildInfo(project, prebuild);
    }

    async getDefaultBranch(project: Project): Promise<string> {
        return "master"; // TODO
    }

    async getPrebuilds(teamId: string, projectName: string): Promise<PrebuildInfo[]> {
        const project = await this.projectDB.findProject(teamId, projectName);
        if (!project) {
            return [];
        }
        const prebuilds = await this.workspaceDb.trace({}).findPrebuiltWorkspacesByProject(project.id);

        const result: PrebuildInfo[] = [];
        for (const prebuild of prebuilds) {
            result.push(await this.toPrebuildInfo(project, prebuild));
        }
        return result;
    }

    async toPrebuildInfo(project: Project, prebuild: PrebuiltWorkspace): Promise<PrebuildInfo> {
        const { teamId, name: projectName } = project;
        return {
            id: prebuild.id,
            startedAt: prebuild.creationTime,
            startedBy: "OWNER",
            teamId,
            project: projectName,
            branch: prebuild.branch || "unknown",
            cloneUrl: prebuild.cloneURL,
            status: prebuild.state,
            changeAuthor: "changeAuthor",
            changeDate: "changeDate",
            changeHash: prebuild.commit,
            changeTitle: "changeTitle",
            // changePR
            // changeUrl
            branchPrebuildNumber: "42"
        };
    }

}
