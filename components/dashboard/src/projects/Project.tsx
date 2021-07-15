/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import moment from "moment";
import { PrebuiltWorkspaceState, Project, ProjectInfo } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { useLocation, useRouteMatch } from "react-router";
import Header from "../components/Header";
import DropDown, { DropDownEntry } from "../components/DropDown";
import { ItemsList, Item, ItemField, ItemFieldContextMenu } from "../components/ItemsList";
import { getGitpodService } from "../service/service";
import { TeamsContext, getCurrentTeam } from "../teams/teams-context";
import { prebuildStatusIcon, prebuildStatusLabel } from "./Prebuilds";
import { ContextMenuEntry } from "../components/ContextMenu";

export default function () {
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const match = useRouteMatch<{ team: string, resource: string }>("/:team/:resource");
    const projectName = match?.params?.resource;
    const team = getCurrentTeam(location, teams);

    const [project, setProject] = useState<ProjectInfo | undefined>();

    const [projectDetails, setProjectDetails] = useState<Project.Overview | undefined>(undefined);

    const [searchFilter, setSearchFilter] = useState<string | undefined>();
    const [statusFilter, setStatusFilter] = useState<PrebuiltWorkspaceState | undefined>();

    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
            const projects = await getGitpodService().server.getProjects(team.id);

            const project = projects.find(p => p.name === projectName);
            if (project) {
                setProject(project);
                setProjectDetails(await getGitpodService().server.getProjectOverview(team.id, project.name));
                if (projectDetails) {
                    Object.keys(projectDetails)
                }
            }
        })();
    }, [team]);

    const toRemoteURL = (cloneURL: string) => {
        return cloneURL.replace("https://", "");
    }

    const prebuildContextMenu = (branch: Project.BranchDetails) => {
        const entries: ContextMenuEntry[] = [];
        entries.push({
            title: "New Workspace",
            onClick: () => { }
        });
        entries.push({
            title: "Trigger Prebuild",
            onClick: () => { },
            separator: true
        });
        entries.push({
            title: "Cancel Prebuild",
            customFontStyle: 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300',
            onClick: () => { }
        })
        return entries;
    }

    const statusFilterEntries = () => {
        const entries: DropDownEntry[] = [];
        entries.push({
            title: 'All',
            onClick: () => setStatusFilter(undefined)
        });
        entries.push({
            title: 'READY',
            onClick: () => setStatusFilter("available")
        });
        return entries;
    }

    const filter = (branch: Project.BranchDetails) => {
        if (statusFilter && branch.lastPrebuild && statusFilter !== branch.lastPrebuild.status) {
            return false;
        }
        if (searchFilter && `${branch.changeTitle} ${branch.name}`.toLowerCase().includes(searchFilter.toLowerCase()) === false) {
            return false;
        }
        return true;
    }

    return <>
        <Header title={project?.name || ""} subtitle={toRemoteURL(project?.cloneUrl || "")} />
        <div className="lg:px-28 px-10">
            <div className="flex mt-8">
                <div className="flex">
                    <div className="py-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="16" height="16"><path fill="#A8A29E" d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z" /></svg>
                    </div>
                    <input type="search" placeholder="Search Active Brancehs" onChange={e => setSearchFilter(e.target.value)} />
                </div>
                <div className="flex-1" />
                <div className="py-3 pl-3">
                    <DropDown prefix="Prebuild Status: " contextMenuWidth="w-32" entries={statusFilterEntries()} />
                </div>
            </div>
            <ItemsList className="mt-2">
                <Item header={true} className="grid grid-cols-3">
                    <ItemField>
                        <span>Branch</span>
                    </ItemField>
                    <ItemField>
                        <span>Commit</span>
                    </ItemField>
                    <ItemField>
                        <span>Prebuild</span>
                        <ItemFieldContextMenu />
                    </ItemField>
                </Item>
                {projectDetails && Object.keys(projectDetails).map(branchName => {
                    const branch = projectDetails[branchName];
                    if (!filter(branch)) {
                        return undefined;
                    }
                    return <Item className="grid grid-cols-3">
                        <ItemField className="flex items-center">
                            <div>
                                <div className="text-base text-gray-900 dark:text-gray-50 font-medium mb-1">
                                    {branchName}
                                </div>
                                <p>Updated _ minutes ago</p>
                            </div>
                        </ItemField>
                        <ItemField className="flex items-center">
                            <div>
                                <div className="text-base text-gray-500 dark:text-gray-50 font-medium mb-1">{branch.changeTitle}</div>
                                <p>{branch.changeAuthorAvatar && <img className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2" src={branch.changeAuthorAvatar || ''} alt={branch.changeAuthor} />}Authored {moment(branch.changeDate).fromNow()} · {branch.changeHash}</p>
                            </div>
                        </ItemField>
                        <ItemField className="flex items-center">
                            <div className="text-base text-gray-900 dark:text-gray-50 font-medium uppercase mb-1">
                                <div className="inline-block align-text-bottom mr-2 w-4 h-4">{branch.lastPrebuild?.status && prebuildStatusIcon(branch.lastPrebuild.status)}</div>
                                {branch.lastPrebuild?.status && prebuildStatusLabel(branch.lastPrebuild.status)}
                            </div>
                            <span className="flex-grow" />
                            <ItemFieldContextMenu menuEntries={prebuildContextMenu(branch)} />
                        </ItemField>
                    </Item>}
                    )}
            </ItemsList>
        </div>

    </>;
}