/* eslint-disable camelcase */
import React from 'react';
import { mount, render } from 'enzyme';
import toJson from 'enzyme-to-json';
import ConfigurationCard from './ConfigurationCard';
import configureStore from 'redux-mock-store';
import { configTest } from '../../../__mocks__/selectors';

const location = {};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => location,
  useHistory: () => ({
    push: () => undefined,
  }),
}));

describe('ConfigurationCard', () => {
  let initialState;
  let mockStore;

  beforeEach(() => {
    mockStore = configureStore();
    initialState = {
      systemProfileStore: {
        systemProfile: {
          loaded: true,
          ...configTest,
        },
      },
    };
    location.pathname = 'localhost:3000/example/path';
  });

  it('should render correctly - no data', () => {
    const store = mockStore({ systemProfileStore: {}, entityDetails: {} });
    const wrapper = render(<ConfigurationCard store={store} />);
    expect(toJson(wrapper)).toMatchSnapshot();
  });

  it('should render correctly with data', () => {
    const store = mockStore(initialState);
    const wrapper = render(<ConfigurationCard store={store} />);
    expect(toJson(wrapper)).toMatchSnapshot();
  });

  it('should render enabled/disabled', () => {
    const store = mockStore({
      systemProfileStore: {
        systemProfile: {
          loaded: true,
          ...configTest,
          repositories: {
            enabled: [{}],
            disabled: [{}],
          },
        },
      },
    });
    const wrapper = render(<ConfigurationCard store={store} />);
    expect(toJson(wrapper)).toMatchSnapshot();
  });

  describe('api', () => {
    it('should NOT call handleClick', () => {
      const store = mockStore(initialState);
      const onClick = jest.fn();
      const wrapper = mount(<ConfigurationCard store={store} />);
      wrapper.find('dd a').first().simulate('click');
      expect(onClick).not.toHaveBeenCalled();
      expect(toJson(wrapper)).toMatchSnapshot();
    });

    it('should call handleClick on packages', () => {
      const store = mockStore(initialState);
      const onClick = jest.fn();
      location.pathname = 'localhost:3000/example/installed_packages';
      const wrapper = mount(
        <ConfigurationCard handleClick={onClick} store={store} />
      );
      wrapper.find('dd a').first().simulate('click');
      expect(onClick).toHaveBeenCalled();
    });

    it('should call handleClick on services', () => {
      const store = mockStore(initialState);
      const onClick = jest.fn();
      location.pathname = 'localhost:3000/example/services';
      const wrapper = mount(
        <ConfigurationCard handleClick={onClick} store={store} />
      );
      wrapper.find('dd a').at(1).simulate('click');
      expect(onClick).toHaveBeenCalled();
    });

    it('should call handleClick on processes', () => {
      const store = mockStore(initialState);
      const onClick = jest.fn();
      location.pathname = 'localhost:3000/example/running_processes';
      const wrapper = mount(
        <ConfigurationCard handleClick={onClick} store={store} />
      );
      wrapper.find('dd a').at(2).simulate('click');
      expect(onClick).toHaveBeenCalled();
    });

    it('should call handleClick on repositories', () => {
      const store = mockStore(initialState);
      const onClick = jest.fn();
      location.pathname = 'localhost:3000/example/repositories';
      const wrapper = mount(
        <ConfigurationCard handleClick={onClick} store={store} />
      );
      wrapper.find('dd a').at(3).simulate('click');
      expect(onClick).toHaveBeenCalled();
    });
  });

  ['hasPackages', 'hasServices', 'hasProcesses', 'hasRepositories'].map(
    (item) =>
      it(`should not render ${item}`, () => {
        const store = mockStore(initialState);
        const wrapper = render(
          <ConfigurationCard store={store} {...{ [item]: false }} />
        );
        expect(toJson(wrapper)).toMatchSnapshot();
      })
  );

  it('should render extra', () => {
    const store = mockStore(initialState);
    const wrapper = render(
      <ConfigurationCard
        store={store}
        extra={[
          { title: 'something', value: 'test' },
          {
            title: 'with click',
            value: '1 tests',
            onClick: (_e, handleClick) => handleClick('Something', {}, 'small'),
          },
        ]}
      />
    );
    expect(toJson(wrapper)).toMatchSnapshot();
  });
});
