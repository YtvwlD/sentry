import {Link} from 'react-router';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {defined} from 'app/utils';
import {t} from 'app/locale';
import AreaChart from 'app/components/charts/areaChart';
import AsyncView from 'app/views/asyncView';
import DataZoom from 'app/components/charts/components/dataZoom';
import DateTime from 'app/components/dateTime';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import EventsContext from 'app/views/organizationEvents/eventsContext';
import HealthPanelChart from 'app/views/organizationHealth/styles/healthPanelChart';
import HealthRequest from 'app/views/organizationHealth/util/healthRequest';
import IdBadge from 'app/components/idBadge';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import ToolBox from 'app/components/charts/components/toolBox';
import Tooltip from 'app/components/tooltip';
import withOrganization from 'app/utils/withOrganization';

class OrganizationEvents extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  constructor(props) {
    super(props);
    this.projectsMap = new Map(
      props.organization.projects.map(project => [project.id, project])
    );
  }

  getTitle() {
    return `${this.props.organization.slug} Events`;
  }

  getEndpoints() {
    const {organization, location} = this.props;

    return [
      [
        'events',
        `/organizations/${organization.slug}/events/`,
        {
          query: Object.entries(location.query)
            .filter(([key, value]) => defined(value))
            .reduce(
              (acc, [key, value]) => ({
                ...acc,
                [key]: value,
              }),
              {}
            ),
        },
      ],
    ];
  }

  getEventTitle(event) {
    const {organization} = this.props;
    const project = organization.projects.find(({id}) => id === event.projectID);
    return (
      <Link to={`/${organization.slug}/${project.slug}/issues/?query=${event.eventID}`}>
        {event.message.split('\n')[0].substr(0, 100)}
      </Link>
    );
  }

  renderBody() {
    const {organization} = this.props;
    const {events, eventsPageLinks} = this.state;
    const hasEvents = events && !!events.length;

    // TODO(billy): Should health endpoint be deprecated? If not, needs support for
    // absolute dates
    return (
      <React.Fragment>
        <div>
          <HealthRequest
            tag="error.handled"
            includeTimeseries
            interval="1d"
            showLoading
            getCategory={value => (value ? t('Handled') : t('Crash'))}
          >
            {({timeseriesData, previousTimeseriesData}) => {
              return (
                <HealthPanelChart
                  height={200}
                  title={t('Errors')}
                  series={timeseriesData}
                  previousPeriod={previousTimeseriesData}
                >
                  {props => (
                    <AreaChart
                      isGroupedByDate
                      {...props}
                      dataZoom={DataZoom()}
                      toolBox={ToolBox(
                        {},
                        {
                          dataZoom: {},
                          restore: {},
                        }
                      )}
                      onEvents={{
                        datazoom: (evt, chart) => {
                          const model = chart.getModel();
                          const {xAxis, series} = model.option;
                          const axis = xAxis[0];
                          const [firstSeries] = series;

                          const start = new Date(
                            firstSeries.data[axis.rangeStart][0]
                          ).toISOString();
                          const end = new Date(
                            firstSeries.data[axis.rangeEnd][0]
                          ).toISOString();
                          this.props.actions.updateParams({
                            statsPeriod: null,
                            start,
                            end,
                          });
                        },
                        click: series => {
                          if (!series) {
                            return;
                          }

                          const firstSeries = series;

                          const date = new Date(firstSeries.name).toISOString();

                          this.props.actions.updateParams({
                            statsPeriod: null,
                            start: date,
                            end: date,
                          });
                        },
                      }}
                    />
                  )}
                </HealthPanelChart>
              );
            }}
          </HealthRequest>
        </div>

        <Panel>
          <PanelHeader hasButtons>
            {t('Events')}
            {this.renderSearchInput({})}
          </PanelHeader>

          <Wrapper>
            {!hasEvents && <EmptyStateWarning>No events</EmptyStateWarning>}
            {hasEvents && (
              <Table>
                <tbody>
                  {events.map((event, eventIdx) => {
                    const project = this.projectsMap.get(event.projectID);
                    return (
                      <tr key={event.eventID}>
                        <Td>
                          <Link to={`/${organization.slug}/${project.slug}/`}>
                            <Tooltip title={project.slug}>
                              <IdBadge project={project} hideName />
                            </Tooltip>
                          </Link>
                        </Td>

                        <Td>
                          <EventTitle>{this.getEventTitle(event)}</EventTitle>
                        </Td>

                        <Td>
                          <IdBadge user={event.user} hideEmail />
                          <DateRow>
                            <DateTime date={new Date(event.dateCreated)} />
                          </DateRow>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Wrapper>
        </Panel>

        <Pagination pageLinks={eventsPageLinks} />
      </React.Fragment>
    );
  }
}

class OrganizationEventsContainer extends React.Component {
  render() {
    return (
      <EventsContext.Consumer>
        {context => <OrganizationEvents {...context} {...this.props} />}
      </EventsContext.Consumer>
    );
  }
}
export default withOrganization(OrganizationEventsContainer);
export {OrganizationEvents};

const Wrapper = styled(PanelBody)`
  overflow-x: scroll;
  padding: 0;
`;
const Table = styled('table')`
  border: 0;
  width: 100%;
  max-width: 100%;
  margin: 0;
`;

const Td = styled('td')`
  padding: 10px 15px;
  white-space: nowrap;
  border-top: 1px solid ${p => p.theme.borderLight};
  vertical-align: middle;

  tr:first-child & {
    border-top: none;
  }
`;

const DateRow = styled('div')`
  font-size: 0.85em;
  opacity: 0.8;
`;

const EventTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 600;
`;
